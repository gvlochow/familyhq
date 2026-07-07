"""
Harness de clasificación de rol iFlight NEO -> estado familiar (FamilyHQ).

Objetivo: función determinística y testeable que toma un .ics de Google Calendar
(sincronizado por iFlight, con eventos personales mezclados) y produce, por día,
el estado familiar del integrante: EN_CASA / FUERA / STANDBY_CASA / POR_CONFIRMAR.

Decisiones clave (ver PRD FamilyHQ):
- Solo se procesan eventos con la firma de iFlight. Todo lo demás se descarta en
  memoria, nunca se persiste (requisito de privacidad, Ley 19.628).
- El buffer de llegada se aplica al ÚLTIMO evento de una rotación, no a cada tramo.
- "Blank/B" es un tercer estado (POR_CONFIRMAR), no "en casa".
- Las horas del feed de Google vienen en UTC (con Z); se convierten a America/Santiago.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from enum import Enum
from zoneinfo import ZoneInfo
from icalendar import Calendar

IFLIGHT_MARK = "com.ibsplc.iflight.crew.mobility"
TZ_LOCAL = ZoneInfo("America/Santiago")

# Buffers por defecto (minutos). En la app son configurables por integrante.
DEFAULT_BUFFER_SALIDA_MIN = 90   # antes del report time
DEFAULT_BUFFER_LLEGADA_MIN = 45  # despues del ultimo debrief/aterrizaje


class Estado(str, Enum):
    EN_CASA = "en_casa"
    FUERA = "fuera"
    STANDBY_CASA = "standby_casa"      # HSB: en casa pero llamable
    POR_CONFIRMAR = "por_confirmar"    # Blank/B


# --- Clasificacion de un evento individual de actividad ---------------------

# Codigos de actividad (SUMMARY "Activity : XXX at YYY" / DESCRIPTION legible)
ACTIVITY_MAP = {
    "DO": Estado.EN_CASA,        # Day off
    "DH": Estado.EN_CASA,        # Holiday day off
    "HSB1": Estado.STANDBY_CASA,  # Home standby
    "HSB": Estado.STANDBY_CASA,
    "ASB3": Estado.FUERA,        # Airport standby (esta en el aeropuerto)
    "ASB": Estado.FUERA,
    "B": Estado.POR_CONFIRMAR,   # Blank
}


@dataclass
class RosterEvent:
    """Evento de rol ya filtrado (tiene la firma iFlight)."""
    uid: str
    summary: str
    description: str
    start_utc: datetime
    end_utc: datetime
    kind: str = ""       # 'activity' | 'flight' | 'report' | 'window'
    code: str = ""       # DO, DH, HSB1, ASB3, B para activities

    @property
    def start_local(self) -> datetime:
        return self.start_utc.astimezone(TZ_LOCAL)

    @property
    def end_local(self) -> datetime:
        return self.end_utc.astimezone(TZ_LOCAL)


def _classify_kind(summary: str) -> tuple[str, str]:
    """Devuelve (kind, code) a partir del SUMMARY."""
    s = summary.strip()
    if s.startswith("Activity :"):
        # "Activity : DO at SCL" -> DO
        mid = s.replace("Activity :", "").strip()
        code = mid.split(" at ")[0].strip()
        return "activity", code
    if s.startswith("Flight :"):
        return "flight", ""
    if s.startswith("Report Time") or s.startswith("Report time"):
        return "report", ""
    if s.startswith("Start Time"):
        # ventana operacional generica (envuelve el dia de trabajo)
        return "window", ""
    return "other", ""


# --- Carga y filtrado del .ics ----------------------------------------------

def load_roster_events(ics_path: str) -> list[RosterEvent]:
    """Carga el .ics y devuelve SOLO eventos de rol (con firma iFlight).
    Los eventos personales se descartan aca y nunca salen de esta funcion."""
    with open(ics_path, "rb") as f:
        cal = Calendar.from_ical(f.read())

    events: list[RosterEvent] = []
    for comp in cal.walk("VEVENT"):
        creator = str(comp.get("X-APPLE-CREATOR-IDENTITY", ""))
        if IFLIGHT_MARK not in creator:
            continue  # <-- descarte de dato personal, en memoria, sin persistir

        start = comp.get("DTSTART").dt
        end = comp.get("DTEND").dt
        # Normalizar a datetime UTC-aware
        start_utc = _to_utc(start)
        end_utc = _to_utc(end)

        summary = str(comp.get("SUMMARY", ""))
        description = str(comp.get("DESCRIPTION", ""))
        kind, code = _classify_kind(summary)

        events.append(RosterEvent(
            uid=str(comp.get("UID", "")),
            summary=summary,
            description=description,
            start_utc=start_utc,
            end_utc=end_utc,
            kind=kind,
            code=code,
        ))
    return events


def _to_utc(dt) -> datetime:
    """Normaliza un valor DTSTART/DTEND a datetime UTC-aware."""
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            # Sin tz: el feed de Google trae Z, asi que esto no deberia pasar.
            # Si pasara, asumimos UTC (documentado como supuesto del harness).
            return dt.replace(tzinfo=ZoneInfo("UTC"))
        return dt.astimezone(ZoneInfo("UTC"))
    # date puro (all-day) -> medianoche local
    return datetime(dt.year, dt.month, dt.day, tzinfo=TZ_LOCAL).astimezone(ZoneInfo("UTC"))


# --- Deteccion de rotaciones (pairings multi-dia) ---------------------------

@dataclass
class DutyBlock:
    """Bloque de trabajo continuo (una rotacion): del primer report al ultimo debrief."""
    start_utc: datetime
    end_utc: datetime
    events: list[RosterEvent] = field(default_factory=list)

    @property
    def start_local(self): return self.start_utc.astimezone(TZ_LOCAL)
    @property
    def end_local(self): return self.end_utc.astimezone(TZ_LOCAL)


def build_duty_blocks(events: list[RosterEvent],
                      buffer_llegada_min: int = DEFAULT_BUFFER_LLEGADA_MIN
                      ) -> list[DutyBlock]:
    """Agrupa vuelos/reports contiguos en bloques de trabajo (rotaciones).
    Regla: dos eventos de vuelo/report que se solapan o estan a < 8h se
    consideran la misma rotacion. El buffer de llegada se aplica UNA vez,
    al final del bloque completo."""
    duty = sorted([e for e in events if e.kind in ("flight", "report")],
                  key=lambda e: e.start_utc)
    blocks: list[DutyBlock] = []
    if not duty:
        return blocks

    GAP = timedelta(hours=8)  # descanso que separa dos rotaciones
    cur = DutyBlock(duty[0].start_utc, duty[0].end_utc, [duty[0]])
    for e in duty[1:]:
        if e.start_utc - cur.end_utc <= GAP:
            cur.end_utc = max(cur.end_utc, e.end_utc)
            cur.events.append(e)
        else:
            blocks.append(cur)
            cur = DutyBlock(e.start_utc, e.end_utc, [e])
    blocks.append(cur)

    # Aplicar buffer de llegada al final de cada bloque
    for b in blocks:
        b.end_utc = b.end_utc + timedelta(minutes=buffer_llegada_min)
    return blocks


# --- Estado por dia ----------------------------------------------------------

def estado_por_dia(events: list[RosterEvent],
                   dia: date,
                   buffer_llegada_min: int = DEFAULT_BUFFER_LLEGADA_MIN
                   ) -> Estado:
    """Estado familiar para un dia calendario (en hora local)."""
    blocks = build_duty_blocks(events, buffer_llegada_min)

    # 1. Si el dia cae dentro de un bloque de trabajo -> FUERA
    day_start = datetime(dia.year, dia.month, dia.day, tzinfo=TZ_LOCAL)
    day_end = day_start + timedelta(days=1)
    for b in blocks:
        if b.start_local < day_end and b.end_local > day_start:
            return Estado.FUERA

    # 2. Si no, mirar la actividad asignada a ese dia
    #    (DO/DH/HSB/ASB/B). Tomamos la actividad que cubre el dia.
    estados_dia = []
    for e in events:
        if e.kind != "activity":
            continue
        if e.start_local < day_end and e.end_local > day_start:
            estados_dia.append(ACTIVITY_MAP.get(e.code, Estado.EN_CASA))

    if estados_dia:
        # Prioridad: FUERA > STANDBY_CASA > POR_CONFIRMAR > EN_CASA
        for prioridad in (Estado.FUERA, Estado.STANDBY_CASA,
                          Estado.POR_CONFIRMAR, Estado.EN_CASA):
            if prioridad in estados_dia:
                return prioridad

    # 3. Sin info -> por defecto en casa (dia libre implicito)
    return Estado.EN_CASA


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "roster.ics"
    evs = load_roster_events(path)
    print(f"Eventos de rol (filtrados): {len(evs)}")
    # Rango del mes de julio 2026
    d = date(2026, 7, 1)
    while d <= date(2026, 7, 31):
        est = estado_por_dia(evs, d)
        print(f"  {d.isoformat()} {d.strftime('%a')}: {est.value}")
        d += timedelta(days=1)

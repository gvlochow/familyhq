"""
Tests de los casos borde del clasificador de rol.
Estos son los casos que, si se rompen, hacen que la app mienta sin que nadie lo note.
Corren contra el .ics real de julio de Pablo (roster.ics).

Ejecutar: pytest test_roster_classifier.py -v
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
import pytest

from roster_classifier import (
    load_roster_events, estado_por_dia, build_duty_blocks,
    Estado, IFLIGHT_MARK, TZ_LOCAL,
)

ICS = "roster.ics"


@pytest.fixture(scope="module")
def events():
    return load_roster_events(ICS)


# --- Filtrado de privacidad -------------------------------------------------

def test_solo_eventos_de_rol_pasan_el_filtro(events):
    """Ningun evento personal (sin firma iFlight) debe entrar."""
    # Todos los eventos cargados deben ser de rol; los personales se descartan.
    # Verificamos que no hay summaries de vida personal conocidos.
    personales = ["Cita", "Atención Médica", "Tenis", "Alojamiento",
                  "Matrimonio", "Zoom", "Reunión", "Stay at", "Reservation"]
    for e in events:
        for p in personales:
            assert p not in e.summary, f"Evento personal se filtro mal: {e.summary}"


def test_cantidad_esperada_de_eventos_de_rol(events):
    """En julio+arrastre, el .ics tiene 217 eventos con firma iFlight."""
    assert len(events) == 217


# --- Caso Blank / POR_CONFIRMAR ---------------------------------------------

def test_blank_es_por_confirmar_no_en_casa(events):
    """El 3-jul es Blank. NO debe ser 'en_casa' (seria un falso disponible)."""
    assert estado_por_dia(events, date(2026, 7, 3)) == Estado.POR_CONFIRMAR

def test_segundo_blank_tambien_por_confirmar(events):
    """El 29-jul es el otro Blank del mes."""
    assert estado_por_dia(events, date(2026, 7, 29)) == Estado.POR_CONFIRMAR


# --- Caso rotacion multi-dia (Brasilia) -------------------------------------

def test_rotacion_brasilia_cubre_dias_intermedios(events):
    """La rotacion a Brasilia (sale 9-jul noche, vuelve 11-jul) debe marcar
    FUERA los tres dias, incluido el 10 que no tiene evento propio de inicio."""
    assert estado_por_dia(events, date(2026, 7, 9)) == Estado.FUERA
    assert estado_por_dia(events, date(2026, 7, 10)) == Estado.FUERA
    assert estado_por_dia(events, date(2026, 7, 11)) == Estado.FUERA

def test_dia_despues_de_brasilia_vuelve_a_casa(events):
    """El 13-jul (tras descanso post-rotacion) debe ser en_casa."""
    assert estado_por_dia(events, date(2026, 7, 13)) == Estado.EN_CASA


# --- Caso HSB vs ASB (el que mas engaña) ------------------------------------

def test_hsb_es_standby_en_casa(events):
    """15-jul y 17-jul son HSB1 (home standby): en casa pero llamable.
    NO debe confundirse con estar fuera."""
    assert estado_por_dia(events, date(2026, 7, 15)) == Estado.STANDBY_CASA
    assert estado_por_dia(events, date(2026, 7, 17)) == Estado.STANDBY_CASA

def test_asb_es_fuera(events):
    """16-jul es ASB3 (airport standby): esta EN EL AEROPUERTO -> fuera.
    Este es el par critico con HSB: mismo concepto 'standby', ubicacion opuesta."""
    assert estado_por_dia(events, date(2026, 7, 16)) == Estado.FUERA


# --- Timezone (el error silencioso de 3-4h) ---------------------------------

def test_timezone_report_brasilia_cae_dia_correcto(events):
    """El report de la ida a Brasilia (02:55 UTC del 10-jul) convertido a
    hora local de Santiago debe caer el 9-jul de noche, no el 10 de madrugada.
    Si esto falla, todo el rol esta corrido varias horas."""
    brasilia = [e for e in events
                if "790" in e.summary and e.start_utc.day == 10
                and e.start_utc.month == 7]
    assert brasilia, "No se encontro el vuelo de ida a Brasilia"
    # 02:55 UTC = 23:55 hora Santiago (UTC-3 en invierno... verificar offset real)
    local = brasilia[0].start_local
    assert local.day == 9, f"El report deberia caer el 9-jul local, cayo el {local.day}"


# --- Dias libres normales ---------------------------------------------------

def test_dias_off_son_en_casa(events):
    """Bloque de DO del 4 al 7-jul: todos en_casa."""
    for d in range(4, 8):
        assert estado_por_dia(events, date(2026, 7, d)) == Estado.EN_CASA

def test_bloque_off_fin_de_mes(events):
    """22 al 27-jul es un bloque largo de DO (6 dias en casa)."""
    for d in range(22, 28):
        assert estado_por_dia(events, date(2026, 7, d)) == Estado.EN_CASA

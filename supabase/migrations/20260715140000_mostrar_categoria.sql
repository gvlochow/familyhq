-- =============================================================================
-- FamilyHQ · Preferencia del hogar: mostrar el nombre de la categoría en la agenda
-- =============================================================================
-- Toggle por hogar (Ajustes) para mostrar/ocultar el NOMBRE de la categoría junto
-- al título de la tarea/evento en Inicio, Tareas y Calendario. Con el toggle en
-- false igual se muestra el punto de color; solo se oculta el texto del nombre.
-- Default true = comportamiento actual (el nombre se ve).
-- =============================================================================

alter table public.households
  add column mostrar_categoria boolean not null default true;

comment on column public.households.mostrar_categoria is 'Si se muestra el NOMBRE de la categoría junto al título en la agenda (Inicio/Tareas/Calendario). El punto de color se muestra igual. Default true.';

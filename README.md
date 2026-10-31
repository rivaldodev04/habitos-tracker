# Ritual · Tracker de hábitos

Tracker de hábitos diario, minimalista y sin dependencias. Marca tus hábitos, mantén tus rachas y visualiza tu constancia semanal y mensual desde el navegador.

> Tus datos se guardan localmente en el navegador. No hay servidor, cuentas ni tracking.

## Características

- **Checklist diario** con 4 hábitos de ejemplo iniciales y posibilidad de añadir los tuyos.
- **Rachas** por hábito y mejor racha activa.
- **Anillo de progreso** con porcentaje completado del día.
- **Estadísticas** de los últimos 7 o 30 días con porcentaje medio, días perfectos y gráfico de barras por día.
- **Filtros** rápidos: todas, pendientes o completadas.
- **Edición y borrado** de hábitos con menú contextual por fila.
- **Emojis** personalizados para cada hábito.
- **Tema claro / oscuro** con preferencia guardada.
- **Exportación a CSV** del historial completo (con BOM, compatible con Excel).
- **Celebración con confeti** al completar el 100 % del día.
- **Persistencia en `localStorage`** con historial de hasta 366 días y reinicio automático diario.
- **Interfaz responsive** y accesible (roles ARIA, foco visible, `Esc` para cerrar paneles y cancelar edición).

## Tecnologías

HTML5, CSS3 y JavaScript vanilla (ES6+). Sin frameworks, sin build, sin dependencias.

Tipografía [Outfit](https://fonts.google.com/specimen/Outfit) desde Google Fonts.

## Estructura

```
habitos-tracker/
├── index.html   # Estructura y marcado de la interfaz
├── styles.css   # Tema, layout, componentes y animaciones
├── script.js    # Estado, persistencia, estadísticas, export CSV y confeti
└── .gitignore
```

## Uso local

Al ser un sitio estático no necesita instalación ni compilación.

**Opción 1:** abre `index.html` directamente en el navegador.

**Opción 2 (recomendada):** sirve la carpeta con cualquier servidor estático:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

Luego visita `http://localhost:8000`.

## Datos y privacidad

- El estado se guarda en `localStorage` bajo la clave `ritual.habits.v1`.
- Incluye hábitos, historial diario (`history`), archivo de hábitos eliminados (`archive`), tema y fecha del último acceso.
- El historial se recorta a **366 días** y se eliminan los hábitos borrados de los días posteriores.
- Para borrar todo: *DevTools → Application → Local Storage → eliminar `ritual.habits.v1`*.
- **Exportar CSV** descarga un archivo `ritual-progreso-YYYY-MM-DD.csv` con fecha, día, total de hábitos, completados, porcentaje y nombres.

## Despliegue en GitHub Pages

1. Ve a **Settings → Pages** en el repositorio.
2. En *Source* selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`.
4. Guarda y espera a que publique en `https://rivaldodev04.github.io/habitos-tracker/`.

## Autor

**rivaldodev04** · [rivaldodev.contact@gmail.com](mailto:rivaldodev.contact@gmail.com)

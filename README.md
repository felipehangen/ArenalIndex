# Arenal Index

Sitio público: https://arenalindex.com/

Este repositorio contiene el diseño aprobado del explorador de terrenos: mapa, listado por scroll, filtros con histogramas, favoritos locales y fichas con galería. Los importes y áreas se muestran sin decimales.

## Desarrollo y publicación

Requiere Node.js 22 o superior y Python 3 para el servidor local. No requiere instalar paquetes.

```sh
npm test
npm run build
npm run preview
```

La vista previa se abre en http://127.0.0.1:8766/. `npm run dev` sirve directamente `site/`.

La fuente de la web está en `site/`. `scripts/build.mjs` valida los scripts y prepara `dist/`. Los cambios enviados a `main` se prueban y publican automáticamente mediante `.github/workflows/pages.yml`. El dominio se conserva en la configuración de GitHub Pages y en `site/CNAME`.

## Supabase: SmallPages

Proyecto: `clxntjpofnivxaxmlxui`.

Tabla propia: `public.arenalindex_properties`. No se modifican las tablas de otras páginas. La versión anterior del sitio usaba otro proyecto, que no se modifica.

`site/config.js` contiene exclusivamente la URL y una clave **publishable**, apta para el navegador. No agregar claves secretas, contraseñas ni `service_role` al repositorio.

El catálogo se consulta al abrir la página. RLS permite leer únicamente filas con `status = 'published'`; `anon` y `authenticated` no pueden insertar, actualizar ni eliminar. La edición se realiza desde el Table Editor de Supabase con la cuenta administradora. Los favoritos se guardan en este navegador, sin datos personales en la base.

### Editar propiedades

- `id`: identificador estable en minúsculas, números y guiones; forma el enlace `/#propiedad/id`.
- `name`, `description`, `place`: título, breve descripción y localidad.
- `price`: precio total en USD; `area`: metros cuadrados. El precio por m² se calcula.
- `lat`, `lng`: coordenadas; `approximate` indica si son aproximadas.
- `house`, `volcano`, `river`, `water`, `electricity`, `well`, `private_residential`: características.
- `images`: arreglo de URLs HTTPS o rutas de fotos del sitio. Una propiedad real sin fotos muestra un marcador de fotografías pendientes.
- `status`: `draft` oculta el anuncio, `published` lo muestra, `archived` lo retira del catálogo.
- `sort_order`: posición en el listado.
- `is_demo`: distingue los anuncios de ejemplo de los reales.

Los límites de precio/área y las localidades se ajustan a los datos publicados. No hay catálogo de respaldo que vuelva a mostrar anuncios retirados si Supabase falla: se muestra un error con opción de reintentar.

## Datos iniciales y alcance

Las migraciones en `supabase/migrations/` crean la tabla y cargan los **100 anuncios ficticios del prototipo**, con `is_demo = true`. Se aplicaron en SmallPages el 29 de octubre de 2026. La primera migración se ejecuta una sola vez; la segunda no reemplaza filas existentes. `demo-properties.json` documenta el inventario inicial y no se sirve como catálogo alternativo.

Las fotos actuales son ilustraciones. El formulario de consulta permite preparar y copiar un mensaje; todavía no hay contacto de corredor ni envío de consultas. No se ha añadido un panel administrador, autenticación de visitantes ni almacenamiento de información privada. Para empezar a operar con anuncios reales, registrar los datos y fotos verificados y asignar el canal de contacto.

## Recuperación de la versión anterior

Se conservan las ramas:

- `backup/before-local-redesign-20261029`: fuente anterior (`624fcd8`).
- `backup/published-before-redesign-20261029`: versión que se servía desde `gh-pages`.

El historial no se reescribe. Para volver a la publicación anterior, seleccionar en GitHub Pages “Deploy from a branch”, rama `gh-pages`, carpeta `/`, manteniendo `arenalindex.com` como dominio.

## Verificación

`npm test` comprueba la adaptación de datos, valores inválidos, fotos faltantes, paginación, catálogo vacío y fallos de red. `npm run build` valida sintaxis y rechaza configuración con claves secretas. Se comprueba además la carga del catálogo real y la política de solo lectura.

Mapa: MapLibre GL JS y OpenStreetMap, con atribución visible. Librerías externas fijadas a sus versiones actuales del prototipo; las teselas requieren conexión a internet.

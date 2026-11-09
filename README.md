# Arenal Index

Sitio público: https://arenalindex.com/

Este repositorio contiene el diseño aprobado del explorador de terrenos: mapa, listado por scroll, filtros con histogramas, favoritos locales y fichas con galería. Los importes y áreas se muestran sin decimales.

## Desarrollo y publicación

Requiere Node.js 22 o superior y Python 3 para el servidor local. Instalar las dependencias con `npm ci`.

```sh
npm ci
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

Las fotos actuales son ilustraciones. El formulario de consulta permite preparar y copiar un mensaje; todavía no hay contacto de corredor ni envío de consultas. Las fichas del catálogo antiguo se administran en Supabase. Los nuevos anuncios se preparan y publican desde su revisión privada, como se describe abajo. Para empezar a operar con anuncios reales, registrar los datos y fotos verificados y asignar el canal de contacto.

## Captación y revisión de propiedades

`https://arenalindex.com/newlisting` es el formulario de captación. `/requisitos` y `/requisitos.html` redirigen a la nueva ruta y conservan el borrador anterior en IndexedDB. La página no aparece en el catálogo y usa `noindex,nofollow`. El pin representa siempre la **entrada**.

El vendedor puede guardar un borrador incompleto. Para enviar se requieren contacto, autorización, entrada confirmada, precio y moneda, área declarada, plano catastrado, respuestas básicas (se admite «No confirmado») y fotos o una excepción que el revisor deberá aceptar. Cada construcción tiene un registro independiente; su área es opcional. Los documentos permanecen privados y no convierten las declaraciones del vendedor en hechos verificados.

La referencia privada identifica el borrador y el correo de revisión. El nombre corto sugerido para el anuncio es un campo distinto y opcional, con límite de 45 caracteres; no se copia automáticamente al catálogo. Debe describir un rasgo comprobable, sin datos personales, dirección exacta, precio, emojis ni mayúsculas sostenidas. El vendedor lo propone y ArenalIndex decide el título público definitivo durante la revisión y preparación del anuncio. El formulario distingue la vía de llegada, un posible camino privado o servidumbre hasta la entrada y un camino dentro de la propiedad. «Residencial» se refiere a un desarrollo con vías públicas; «condominio» al régimen con áreas comunes privadas. El régimen declarado queda sujeto a revisión documental.

La primera vista de cada paso prioriza las preguntas necesarias. Los detalles opcionales se despliegan por tema y se abren al retomar respuestas guardadas. Una diferencia entre el área declarada y la del plano avisa al vendedor sin impedir el envío; debe resolverse antes de aprobar. El texto para compradores conserva las fuentes declaradas, las condiciones conocidas y la diferencia entre uso actual y usos permitidos. El recorrido muestra la portada y agrupa las fotos por tema y construcción, con pies automáticos en español y la distinción entre suelo y dron.

«Venta y contacto» reúne el precio, las condiciones y la persona responsable. «Resumen y envío» es el paso siguiente, con la vista previa, los pendientes, las autorizaciones y el envío privado para revisión. En «Fotos», una lista indica qué falta: dos fotos del terreno, entrada y vía de llegada identificadas, un exterior por construcción y una portada. Cada grupo y el paso muestran su check al completarse, también en el menú móvil. Una excepción explicada permite enviar las tomas faltantes a revisión, pero no reemplaza la portada ni la aceptación del revisor.

El resumen detalla cada pendiente y su sección. Para fotos, distingue archivos faltantes de tomas sin identificar y explica cómo resolverlo. «Completar» abre el grupo de archivos correspondiente o enfoca el campo pendiente.

«Ver como comprador» abre una vista privada del borrador con el mismo diseño de la ficha pública: portada, recorrido de fotos, características y mapa. Lee el borrador guardado en este navegador; las fotos permanecen locales y no se envía ni publica la ficha. Los datos incompletos, el título no propuesto y la localidad editorial se muestran por definir. Las medidas declaradas no se presentan como revisadas. Documentos, contacto privado y tokens quedan fuera de esta vista. La revisión aprobada conserva su vista previa de publicación con los datos editoriales definitivos.

Se admiten JPG/PNG/WebP/PDF, hasta 12 MB por archivo y 60 MB en total. El navegador guarda respuestas y adjuntos localmente; un respaldo JSON permite trasladarlos. El respaldo no contiene los tokens de acceso ni reemplaza una ficha enviada: se restaura como un borrador nuevo. El mismo perfil de navegador puede abrir su borrador y borrar los datos del navegador elimina esa copia.

Al enviar, `prepare` crea una nueva versión, se cargan los adjuntos directamente al almacenamiento privado y `submit` comprueba tamaños, tipos y firmas de archivos. La ficha pasa a **Lista para revisión de publicación** y Resend envía el aviso a `felipehangen@gmail.com`. Si el correo falla, la ficha permanece recibida y se puede reintentar el aviso. Una respuesta de red perdida se recupera consultando el estado.

El correo abre `/newlisting/review/` con un enlace privado que vence en siete días. Abrirlo no aprueba ni publica. El revisor confirma plano y área, resuelve discrepancias, acepta excepciones de fotos cuando corresponda y revisa el texto, los permisos y las condiciones conocidas. Puede aprobar una versión o solicitar cambios. Reabrir la ficha invalida la revisión anterior antes de permitir cambios.

La revisión incluye una lista opcional de condiciones de acceso, agua, terreno, instalaciones y construcciones. Distingue lo reportado de lo observado por ArenalIndex, conserva las observaciones al solicitar cambios e incorpora los hallazgos al texto del comprador. «Sin revisar» y «No se reporta» no se presentan como ausencia verificada. No se exige una visita profesional. Cambiar los datos que alimentan el texto obliga a confirmar nuevamente su revisión.

**Aprobar autoriza una versión; publicar sigue siendo una acción separada.** Una vez aprobada, el revisor elige el título público definitivo (hasta 45 caracteres), la localidad, una introducción opcional y, si corresponde, un WhatsApp público explícito. «Ver como comprador» abre la misma ficha que verá el visitante, con enlaces privados temporales a las fotos. Después de confirmar la presentación, «Publicar en ArenalIndex» incorpora el anuncio. También puede actualizarlo o retirarlo desde esa revisión. Los enlaces de revisión mantienen su vencimiento de siete días; un enlace vencido no permite publicar ni retirar.

La ficha pública incluye área documentada, área declarada cuando difiere, llegada y acceso, servicios y sus fuentes, residencial/condominio, cada construcción, condiciones conocidas y un recorrido de fotos por tema y construcción. Los importes se muestran en USD o CRC sin conversión implícita. Cuando hay ambas monedas, se ven ambos tipos de anuncio; los filtros de precio requieren elegir una moneda. Los filtros y las tarjetas conservan su tamaño compacto. La revisión editorial no es un servicio de verificación profesional.

### Servicio en Vercel

Proyecto `arenalindex-intake`, endpoint `https://arenalindex-intake.vercel.app/api/intake`. GitHub Pages sigue sirviendo el sitio público y Supabase conserva el catálogo anterior. Los anuncios nuevos publicados se leen desde `GET /api/listings` en este mismo servicio. La recepción de fichas usa Vercel Blob privado (`arenalindex-intake-private`) y Resend; no requiere credenciales administrativas de Supabase.

Variables de Production y Preview:

- `BLOB_READ_WRITE_TOKEN`: proporcionada por la conexión al almacén privado.
- `RESEND_API_KEY`: proporcionada por la integración gratuita de Resend.
- `INTAKE_REVIEW_EMAIL`: destinatario de los avisos de revisión.
- `INTAKE_EMAIL_FROM`: remitente autorizado por Resend.
- `INTAKE_REVIEW_SECRET`: secreto aleatorio de al menos 32 caracteres para los enlaces privados.

El dominio de producción de la API debe ser accesible sin inicio de sesión en Vercel; los tokens privados de la aplicación controlan los expedientes y decisiones. Los documentos se sirven por enlaces firmados de diez minutos. Las URLs de carga solo permiten un archivo, tamaño y tipo concretos, sin sobrescribirlo. Los registros usan lecturas consistentes y escrituras condicionales por ETag para evitar que una solicitud obsoleta reemplace una decisión. Los contadores horarios caducan automáticamente; los expedientes enviados se conservan para la revisión.

El remitente de arranque es `ArenalIndex <onboarding@resend.dev>`, válido únicamente para notificaciones a la cuenta de Resend. Para usar `@arenalindex.com`, completar la verificación DNS de Resend en GoDaddy y cambiar `INTAKE_EMAIL_FROM`. No guardar secretos en `site/config.js`, Git ni registros de ejecución. El archivo local `.env.intake-production`, si existe para pruebas autorizadas, está ignorado por Git.

Publicar el servicio desde este directorio con `vercel deploy --prod`; cambios de variables requieren una nueva publicación. Publicar el formulario con un push a `main`; GitHub Actions instala dependencias, ejecuta pruebas y publica `dist/`. El endpoint `health` informa si están presentes las variables necesarias y responde el almacén; la recepción real del correo debe comprobarse con una prueba explícita de entrega.

## Recuperación de la versión anterior

Se conservan las ramas:

- `backup/before-local-redesign-20261029`: fuente anterior (`624fcd8`).
- `backup/published-before-redesign-20261029`: versión que se servía desde `gh-pages`.

El historial no se reescribe. Para volver a la publicación anterior, seleccionar en GitHub Pages “Deploy from a branch”, rama `gh-pages`, carpeta `/`, manteniendo `arenalindex.com` como dominio.

## Verificación

`npm test` comprueba la adaptación de datos, valores inválidos, fotos faltantes, paginación, catálogo vacío y fallos de red. `npm run build` valida sintaxis y rechaza configuración con claves secretas. Se comprueba además la carga del catálogo real y la política de solo lectura.

Mapa: MapLibre GL JS y OpenStreetMap, con atribución visible. Librerías externas fijadas a sus versiones actuales del prototipo; las teselas requieren conexión a internet.


## Publicación y presentación del anuncio

`server/intake/publication.mjs` construye una proyección explícita de una versión aprobada. Excluye el contacto privado, referencia privada, números y archivos documentales, tokens y comentarios internos. Las condiciones reportadas u observadas, revisadas para compradores, sí se incluyen. Las fotos deben pertenecer a los grupos públicos activos; se conserva la portada, el tema, la construcción y el pie desde suelo/dron.

Los expedientes y sus fotos continúan en Blob privado. `publication` en el expediente es la versión pública vigente. El índice privado `published/` solo descubre expedientes candidatos: la API vuelve a leer el expediente y devuelve exclusivamente su proyección pública vigente. Se escribe ese índice antes de cambiar atómicamente el expediente, evitando publicar un expediente si su versión, estado, autorización o revisión de publicación cambió. Reabrir un borrador conserva la última publicación hasta una actualización o retiro explícito.

Las fotos públicas pasan por `/api/listings?id=…&photo=…&version=…`, que comprueba que la foto pertenece a la publicación vigente y redirige a una URL firmada de diez minutos para esa foto solamente. Esto evita enviar archivos de hasta 12 MB a través de la respuesta de una función. Retirar el anuncio impide emitir nuevos enlaces; uno emitido anteriormente puede funcionar hasta vencer. Los documentos y las fotos internas nunca se incluyen en esta ruta.

No hacen falta nuevas variables ni una migración de Supabase. Publicar primero el servicio Vercel y comprobar `GET /api/listings`, después publicar la web. El catálogo combina la fuente anterior con las nuevas publicaciones; si una fuente falla, muestra un error recuperable en lugar de ocultar silenciosamente anuncios reales.

Para inspeccionar la presentación con datos ficticios completos, ejecutar `node scripts/preview-listing.mjs` y abrir la URL local que imprime. El servidor escucha únicamente en `127.0.0.1:8767`; los ejemplos USD/CRC viven en memoria y no se envían al servicio ni al catálogo. El archivo `tests/publication-fixture.mjs` no forma parte del sitio publicado. Las imágenes de demostración existentes se reutilizan y se identifican como ilustrativas.

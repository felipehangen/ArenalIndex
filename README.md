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

La portada reserva el espacio del mapa y los resultados desde el primer render. Muestra tarjetas provisionales mientras carga el catálogo y un indicador independiente para el mapa. Las dos fuentes de anuncios se consultan en paralelo; solo se muestra el catálogo completo. Si la espera supera ocho segundos se ofrece reintentar, y un fallo del mapa permite seguir explorando la lista. Las animaciones respetan la preferencia de movimiento reducido.

En ventanas de al menos 960 px, la portada ocupa todo el ancho: resultados en una cuadrícula a la izquierda y mapa independiente a la derecha. El listado usa dos columnas (tres desde 1600 px), fotos individuales con carrusel y desplazamiento propio. La cabecera muestra la ubicación como texto y usa una brújula para Explorar; debajo aparecen accesos rápidos a los filtros existentes. En móvil, el botón Filtros abre el mismo diálogo, donde se conserva la selección de barrio o localidad. El mapa se encuadra dentro de su propio panel. Al cambiar entre móvil y escritorio se conserva la posición dentro del listado; el espacio que permite revelar el mapa en móvil no se arrastra al escritorio. El diseño móvil conserva el collage y su panel de desplazamiento nativo. Al volver de Guardados, Explorar recupera los filtros, la selección, la cámara y la posición previa del listado; ambas secciones muestran el mismo indicador verde de selección en móvil y escritorio. Tocar la sección ya activa da un pulso breve sin reiniciar la vista; se omite el movimiento cuando el usuario prefiere movimiento reducido.

## Datos iniciales y alcance

Las migraciones en `supabase/migrations/` crean la tabla y cargan los **100 anuncios ficticios del prototipo**, con `is_demo = true`. Se aplicaron en SmallPages el 29 de octubre de 2026. La primera migración se ejecuta una sola vez; la segunda no reemplaza filas existentes. `demo-properties.json` documenta el inventario inicial y no se sirve como catálogo alternativo.

La actualización del 9 de noviembre se genera con `node scripts/demo-catalog.mjs`, que valida cada ejemplo contra los requisitos actuales del formulario y la publicación. `demo-properties-v2.json` contiene 100 ejemplos: 60 en USD y 40 en CRC, 50 con construcciones, 20 con varias construcciones y 10 en condominio. Varía acceso, servicios, estado de las construcciones y condiciones conocidas. Las fotos y las fuentes se identifican como ficticias. La migración conserva IDs, coordenadas y estado de publicación y solo modifica filas existentes con `is_demo = true`.

Orden de despliegue: aplicar `202611090000_catalog_details.sql`, publicar el lector que solicita `currency,details` y después aplicar `202611090001_demo_refresh.sql`. Así no se interpretan importes en CRC como USD durante la transición. No se modifican las políticas de acceso ni los anuncios reales. El contacto público compartido de los demos se configura en `site/config.js` (`demoContact`). Se aplica al leer anuncios con `is_demo = true`; no cambia el contacto de anuncios reales ni se pierde al regenerar los ejemplos.

Las tarjetas muestran título, localidad, área, precio y hasta tres características con iconos y etiquetas breves. La introducción escrita queda dentro de la ficha. Los iconos se derivan de datos publicados: agua activa y carta de disponibilidad tienen etiquetas distintas; una red cercana no se presenta como servicio activo. No se infiere lago ni tipo específico de cauce a partir de la pregunta agrupada de río/quebrada/naciente.

`details.contact` admite nombre, WhatsApp, teléfono internacional y correo públicos. La ficha ofrece WhatsApp directamente y opciones de llamada/correo en «Contacto». El enlace `wa.me` usa país y número sin signo `+`; `tel:` conserva el `+`. Las consultas incluyen el precio solicitado original y el enlace público de la propiedad, nunca enlaces privados de revisión. En demos, el texto identifica el anuncio como demostración. Abrir WhatsApp o correo prepara la consulta; el visitante decide enviarla. Los contactos privados del formulario no se copian automáticamente.

Las fotos actuales son ilustraciones. Las fichas de demostración ofrecen WhatsApp, llamada y correo al contacto público autorizado. Los anuncios sin contacto asignado permiten preparar y copiar una consulta. Las fichas del catálogo antiguo se administran en Supabase. Los nuevos anuncios se preparan y publican desde su revisión privada, como se describe abajo. Para empezar a operar con anuncios reales, registrar los datos y fotos verificados y asignar el canal de contacto.

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

La ficha pública incluye área documentada, área declarada cuando difiere, llegada y acceso, servicios y sus fuentes, residencial/condominio, cada construcción, condiciones conocidas y un recorrido de fotos por tema y construcción. El comprador elige USD (predeterminado) o CRC como moneda de visualización. Ambas opciones incluyen todos los anuncios; total, precio por m² de terreno, mapa e histogramas usan la misma conversión. El precio solicitado y su moneda original se conservan y aparecen en la ficha. Los equivalentes se muestran sin símbolos adicionales; la ficha los identifica como «Equivalente estimado». El tipo de cambio, su fecha y la fuente están en el desplegable discreto «Tipo de cambio» de los filtros. La moneda no se repite en el menú superior. Cambiar la moneda convierte los límites elegidos sin redondearlos; solo se redondea la presentación. Los filtros y las tarjetas conservan su tamaño compacto. La revisión editorial no es un servicio de verificación profesional.

### Conversión USD / CRC

`site/pricing.js` centraliza las conversiones y prepara los valores de cada anuncio en ambas monedas una vez por carga. No se reescribe el precio original. Los filtros numéricos y los histogramas comparten los valores de tarjetas, agrupaciones y mapa; el denominador del precio por m² sigue siendo el área del terreno, no el área construida. Las consultas al vendedor usan el precio solicitado original.

`npm run update:exchange-rate` consulta los feeds JSON públicos de compra (317) y venta (318) que usa la portada del BCCR. Valida códigos, importes y una fecha efectiva común, sin usar cotizaciones futuras. Guarda `site/exchange-rate.json` y su equivalente de navegador; `npm run build` genera de nuevo el script a partir del JSON validado. El promedio de compra y venta es una referencia de ArenalIndex, no una cotización oficial de pago.

GitHub Pages actualiza el snapshot a las **06:17 de Costa Rica**, con otro intento a las **09:17** si no hubo una consulta exitosa ese día. Los horarios del programador de GitHub son aproximados. Las publicaciones de código también ejecutan la actualización y reutilizan el snapshot del día. Antes de consultar BCCR se recupera el último JSON publicado, para conservarlo entre ejecuciones de CI. Hay tres intentos acotados por ejecución; un fallo conserva fecha y valores previos y deja una advertencia en Actions. La web indica la fecha del dato; si no se ha podido comprobar durante 48 horas, destaca que es el último tipo disponible. Si falta un snapshot válido en el navegador, mantiene los anuncios con sus monedas originales y desactiva temporalmente los filtros monetarios.

El navegador recibe el snapshot como un pequeño archivo estático de ArenalIndex; no consulta al BCCR ni cambia el tipo durante la sesión. No hacen falta credenciales nuevas, otra base de datos ni cambios en la API de captación. Los feeds de la portada del BCCR pueden cambiar de ruta; en ese caso el aviso de Actions y la fecha visible permiten detectar el fallo y actualizar las URLs en `scripts/lib/exchange-rate.mjs`.

### Administración con Google

`https://arenalindex.com/admin/` reúne las fichas recibidas desde `/newlisting/` y los borradores guardados en las cuentas de propietarios. Permite buscar, filtrar por estado, abrir la revisión y **Editar ficha** directamente. **Reabrir para el propietario** pide instrucciones concretas y muestra «Esperando al propietario». La persona ve «Necesita tus cambios» en su portal. Guardar una edición invalida la aprobación anterior; se vuelve a enviar, revisar y publicar. La última versión publicada permanece visible hasta actualizarla o retirarla. El catálogo demo anterior sigue administrándose en Supabase; no se mezcla con esta bandeja de captación.

La localidad se sugiere automáticamente desde el pin de entrada mediante Nominatim/OpenStreetMap. Solo se usa el nombre de la comunidad/distrito, no una dirección postal. Hay caché de siete días y una exclusión compartida para limitar consultas. Si no hay cobertura o el servicio falla, el administrador puede escribir o corregir el nombre. Mover el pin al guardar una ficha elimina la localidad editorial anterior para obtener una nueva sugerencia.

Configurar en Vercel Production `ADMIN_GOOGLE_CLIENT_ID` con el ID público de un cliente OAuth **Web application** y `ADMIN_EMAILS` con los correos autorizados, separados por comas. Si no se indica `ADMIN_EMAILS`, se usa `INTAKE_REVIEW_EMAIL`. El cliente Google permite los orígenes `https://arenalindex.com` y `https://www.arenalindex.com`, sin URI de redirección; usa Google Identity Services con callback JavaScript. No requiere un client secret. En modo Testing, agregar al administrador como usuario de prueba de Google Auth Platform.

`POST /api/admin` comprueba firma, emisor, audiencia, vigencia, correo verificado y nonce de Google, y luego aplica la lista de correos autorizados en el servidor. El desafío dura diez minutos y se consume una sola vez mediante escritura condicional. La sesión aleatoria dura ocho horas, se guarda en `sessionStorage` de la pestaña y solo su hash se almacena en Blob privado. Salir revoca la sesión en el servidor y borra los datos visibles. Una falla de red al salir se informa expresamente; se borra la copia local pero la sesión del servidor conserva su vencimiento original. Quitar un correo de la lista y volver a desplegar revoca su acceso aunque la sesión no haya vencido.

Los desafíos y sesiones del servidor caducan en almacenamiento al día siguiente. La API no almacena el token de identidad Google ni permite otorgar permisos mediante encabezados de identidad. La bandeja entrega resúmenes paginados de 50 registros y carga todas las páginas antes de filtrar; los documentos se firman solamente al abrir una ficha. Las decisiones registran el correo del administrador y conservan las comprobaciones de concurrencia del expediente. No existe una ruta de prueba que omita autenticación.

La API responde con `no-store` y `noindex`; las páginas HTML son únicamente la interfaz sin datos privados. GitHub Pages no permite configurar encabezados HTTP por ruta, por lo que estas páginas incluyen metadatos `noindex,nofollow` y `no-referrer`. El estado privado se borra al vencer la sesión y se vuelve a comprobar al recuperar una página desde el historial.

Publicar primero el servicio Vercel y después el frontend. Para verificar Google de extremo a extremo, el administrador debe iniciar sesión desde `/admin/`; las pruebas automatizadas usan claves RSA y registros en memoria, sin otorgar permisos reales ni publicar fichas.

### Portal de propietarios y acceso

`https://arenalindex.com/owner/` ofrece dos formas de entrar:

- **Google + código reutilizable:** el administrador crea un código en «Invitaciones para propietarios». El código se pide solo para activar una cuenta nueva. Se muestra una sola vez y en el servidor se guarda únicamente su hash. Desactivarlo bloquea nuevas altas, sin quitar acceso a quienes ya entraron.
- **Correo y contraseña:** en «Cuentas y contraseñas de propietarios», el administrador ingresa el correo y crea o genera una contraseña temporal de 12–128 caracteres. Puede usar cualquier proveedor de correo. La contraseña vence en siete días; el propietario debe reemplazarla antes de abrir sus fichas. El administrador copia y comparte el acceso en privado; esta operación no envía correos. Restablecer una contraseña invalida las sesiones anteriores que entraron con contraseña. No se puede consultar la contraseña existente.

Ambos métodos se vinculan a la misma cuenta si coinciden con el correo verificado por Google. El identificador de propietario se conserva, sin duplicar ni transferir fichas. Una contraseña creada para un correo no verificado por el sistema es acceso concedido por el administrador; este debe comprobar que lo entrega a la persona correcta. Google usa el mismo cliente OAuth de la administración. Revisar la configuración de audiencia de Google Auth Platform antes de invitar cuentas externas. El acceso de administrador sigue dependiendo de Google y de `ADMIN_EMAILS`; una contraseña de propietario nunca otorga permisos administrativos.

Las contraseñas se almacenan con scrypt (N=65536, r=8, p=1), sal aleatoria y comparación de tiempo constante. Los intentos se limitan por IP y correo. Las sesiones de propietario duran ocho horas, usan un espacio de claves independiente de administración y solo guardan el hash del token en Blob. La API exige el cambio de contraseña temporal, comprueba acceso activo y versión de contraseña en cada operación. Desactivar una cuenta revoca ambas formas de acceso y las sesiones viejas no se reactivan al volver a habilitarla.

La bandeja del propietario muestra borradores, fichas en revisión, las que necesitan cambios, publicadas y retiradas. «Guardar en mi cuenta» guarda respuestas y archivos aunque falten requisitos. Los cambios también se guardan localmente mientras se escribe; deben guardarse en la cuenta para aparecer en otros dispositivos. «Enviar para revisión» guarda y envía. El propietario puede reabrir su ficha o retirar su anuncio del catálogo, pero solo ArenalIndex puede aprobar y publicar. Retirar conserva la ficha y los documentos.

Cada guardado en la cuenta usa una preparación privada con vencimiento, carga solo archivos nuevos y valida firmas/tamaños antes de cambiar la versión de trabajo. Las escrituras condicionales impiden sobrescribir cambios recientes de otra pestaña o del administrador. Los archivos de la última publicación no se sustituyen durante una edición. Ante un conflicto, el navegador conserva los cambios locales y ofrece guardar una copia antes de cargar la versión actual.

El formulario anónimo de `/newlisting/` continúa funcionando. «Agregar la ficha de este navegador» permite incorporarla a una cuenta: una ficha ya enviada requiere su token privado original; coincidir con el correo de contacto no concede acceso. Las copias locales se separan por cuenta y ficha. Los documentos nunca se incluyen en el catálogo público.

### Servicio en Vercel y variables

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


## Español e inglés

El selector con globo aparece junto a Explorar y Guardados en escritorio, en la navegación inferior en móvil y en el encabezado de la ficha y del anuncio. La primera visita usa el idioma del navegador (`en` para inglés, español para los demás); una elección explícita se conserva en `arenalindex.language`. La preferencia se comparte entre pestañas. Cambiar el idioma conserva filtros, moneda, selección, desplazamiento del listado y respuestas del formulario. Las medidas siguen en m².

`site/i18n-en.js` contiene las traducciones revisadas de la interfaz; `site/i18n.js` traduce etiquetas y mensajes sin modificar valores de formularios ni datos canónicos del catálogo. Los nombres, localidades y respuestas libres se conservan. `site/newlisting/buyer-copy.mjs` prepara el resumen en el idioma seleccionado, separando texto fijo de respuestas del vendedor.

El vendedor puede sugerir un título en español o inglés y agregar una traducción opcional. La revisión decide el título definitivo y la traducción de título/introducción antes de publicar. `details.language` identifica el original y `details.translations.es/en` contiene solo `title` y `description`; ambos títulos tienen el mismo límite de 45 caracteres. Si falta una traducción se muestra el original. No hay un servicio automático de traducción ni nuevas credenciales. Las traducciones de los 100 anuncios ficticios están en `site/demo-translations.js`; los datos originales de Supabase no se modifican.

Las pruebas de idioma usan un DOM en memoria para comprobar selección, textos reversibles, datos privados, títulos revisados y conservación del estado del controlador real del catálogo. Esto no sustituye una revisión visual en escritorio e iPhone.

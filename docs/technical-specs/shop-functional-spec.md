# Especificación funcional del ecommerce

Esta especificación define el comportamiento del ecommerce para negocios pequeños que venden productos y coordinan el pago y la entrega por WhatsApp. El frontend puede usar cualquier estructura visual mientras respete estos flujos y reglas.

## Alcance

El ecommerce permite:

- Publicar productos desde el CMS.
- Mostrar precio, promoción, disponibilidad, stock e imagen.
- Configurar variaciones opcionales, como colores.
- Agregar productos y cantidades al carrito.
- Registrar pedidos para delivery.
- Coordinar el pago por WhatsApp.
- Consultar un pedido mediante su número.
- Administrar pedidos, pagos, delivery y clientes desde el panel.

El alcance no incluye una pasarela de pago ni cuentas de usuario para clientes. El pago se coordina por WhatsApp y los datos del cliente se pueden reutilizar localmente en el mismo navegador.

## Actores

### Cliente

El cliente puede:

- Consultar productos disponibles.
- Seleccionar una variación cuando el producto la tiene.
- Elegir la cantidad.
- Revisar y modificar el carrito.
- Registrar sus datos de delivery.
- Seleccionar una zona de delivery y un método de pago configurado.
- Crear un pedido.
- Abrir WhatsApp para coordinar el pago.
- Consultar el pedido mediante su número.

### Administrador

El administrador puede:

- Configurar datos de la tienda.
- Configurar el código de moneda, su símbolo visible y los métodos de pago. Por ejemplo, `PEN` con símbolo `S/`.
- Configurar zonas de delivery y sus costos.
- Consultar pedidos y filtrar su estado.
- Ver el detalle de un pedido.
- Confirmar el pago.
- Actualizar el estado del delivery.
- Consultar y filtrar clientes.
- Ver el historial de pedidos de un cliente.

## Modelo de producto

Los productos son contenido del CMS en la colección `products`. El frontend debe interpretar estos datos:

- `name`: nombre del producto.
- `price`: precio regular.
- `promotion_price`: precio promocional opcional.
- `featured_image`: imagen principal opcional.
- `availability` o `availability_status`: estado de disponibilidad.
- `stock`: stock del producto base.
- `has_variations`: indica si el producto usa variaciones.
- `variants`: lista de variaciones opcional.

Cada variación puede contener:

- `id` o `label`: identificador de la variación.
- `label`: nombre que se muestra al cliente, por ejemplo `Negro`.
- `image`: imagen específica de la variación.
- `price`: precio de la variación opcional.
- `stock`: stock de la variación opcional.

### Reglas de precio

- El precio regular es `price`.
- Si `promotion_price` es menor que `price`, se muestra y utiliza el precio promocional.
- Una variación con `price` válido utiliza su propio precio.
- Una variación sin precio hereda el precio calculado del producto base.
- El precio usado se copia en el detalle del pedido para conservar el valor de la compra.

### Reglas de stock

- Un producto sin stock configurado se considera disponible mientras no esté marcado como oculto o agotado.
- Un producto con `stock` debe tener una cantidad mayor que cero para estar disponible.
- Si el producto tiene variaciones, la disponibilidad se calcula con las variaciones disponibles.
- Una variación sin stock propio hereda el stock del producto base.
- El cliente no puede agregar más unidades que el stock disponible.
- El servidor vuelve a validar el stock al crear el pedido.
- Si el stock cambió antes de confirmar la compra, el pedido se rechaza con un error de stock no disponible.

## Carrito

El carrito funciona en el navegador y contiene:

- Producto.
- Variación seleccionada, si existe.
- Cantidad.

El cliente puede:

- Agregar un producto base.
- Agregar una variación específica.
- Agregar varias unidades.
- Aumentar o reducir la cantidad.
- Eliminar un producto del carrito.
- Revisar el subtotal y el total.

Un producto base y una variación se consideran líneas diferentes cuando corresponda. El carrito debe conservar la variación para que el pedido registre el color u otra opción seleccionada.

## Flujo de compra

1. El cliente consulta el catálogo.
2. Selecciona un producto.
3. Si el producto tiene variaciones, selecciona una opción o mantiene el producto base.
4. El sistema actualiza imagen, precio, stock y disponibilidad según la selección.
5. El cliente elige la cantidad y agrega el producto al carrito.
6. El cliente revisa el carrito y modifica sus cantidades si es necesario.
7. El cliente continúa al checkout.
8. El sistema solicita nombre, teléfono, correo opcional, dirección, distrito, referencia, zona de delivery, método de pago y notas opcionales.
9. El cliente confirma el pedido.
10. El servidor valida productos, variaciones, precios, stock, zona de delivery y datos obligatorios.
11. El servidor crea el pedido y descuenta el stock.
12. El sistema muestra el número de pedido y un enlace de WhatsApp con el resumen de la compra.
13. El cliente coordina el pago por WhatsApp.

## Reutilización de datos del cliente

El checkout puede guardar localmente en el navegador los siguientes datos:

- Nombre.
- Teléfono.
- Correo.
- Dirección.
- Distrito.
- Referencia.

En una compra posterior, el checkout puede ofrecer rellenar el formulario con esos datos. El cliente debe poder usar los datos guardados, modificarlos o eliminarlos.

Estos datos locales no reemplazan el registro del pedido en el servidor. Cada pedido conserva los datos enviados en ese momento.

La reutilización local no sincroniza datos entre dispositivos ni identifica de forma segura al cliente. La unificación de registros por teléfono y el acceso autenticado a varios pedidos quedan fuera de esta fase.

## Estados del pedido

El pedido utiliza los siguientes estados generales:

- `new`: pedido creado.
- `confirmed`: pago confirmado.
- `preparing`: pedido en preparación.
- `ready`: listo para delivery.
- `in_transit`: pedido en camino.
- `delivered`: entregado.
- `cancelled`: cancelado.
- `not_delivered`: delivery no completado.

El pago utiliza:

- `pending`: pago pendiente de coordinación o confirmación.
- `confirmed`: pago confirmado por el administrador.

El delivery utiliza:

- `pending`.
- `assigned`.
- `in_transit`.
- `delivered`.
- `not_delivered`.

## Seguimiento del pedido

El cliente puede ingresar su número de pedido con o sin el prefijo `#`.

El seguimiento muestra:

- Número de pedido.
- Estado general.
- Estado del pago.
- Estado del delivery.
- Productos y cantidades.
- Precio de cada línea.
- Total.
- Imagen del producto.
- Imagen de la variación cuando la línea tiene una variación con imagen.
- Enlace para coordinar por WhatsApp.

La consulta pública no debe exponer datos completos del cliente ni notas internas.

## Configuración de la tienda

La configuración incluye:

- Nombre de la tienda.
- Moneda ISO de tres letras, por ejemplo `PEN`.
- Número de WhatsApp.
- Mensaje inicial de WhatsApp.
- Métodos de pago habilitados.
- Instrucciones de pago.
- Horario de atención.

El mensaje de WhatsApp comienza con el mensaje personalizado o uno predeterminado. El sistema agrega automáticamente el nombre de la tienda cuando está configurado, seguido del número de pedido, nombre del cliente, datos principales del delivery, líneas de productos y total.

Los métodos de pago representan opciones de coordinación. La pasarela de pago puede agregarse posteriormente sin cambiar el flujo base de creación de pedidos.

La configuración también incluye una sección de pasarela de pago preparada para una integración posterior:

- Activación.
- Proveedor.
- Entorno de pruebas o producción.
- Clave pública.
- Clave privada.
- Secret de webhook.
- URL de retorno.
- URL de webhook.

Guardar estos parámetros no activa el procesamiento de pagos. El flujo continúa por WhatsApp hasta que exista un conector para el proveedor seleccionado. Las claves privadas se cifran con `EMDASH_ENCRYPTION_KEY`, no se devuelven al Admin y Core las descifra únicamente para el conector del proveedor.

### Configurar la clave de cifrado

Configura `EMDASH_ENCRYPTION_KEY` antes de guardar una clave privada de pasarela.

En desarrollo local, genera la clave y escríbela en `.env`:

```bash
npx emdash secrets generate --write .env
```

Reinicia el servidor de desarrollo después de agregar o cambiar la variable.

En Node.js de producción, configura la variable en el entorno del proceso antes de iniciar la aplicación:

```bash
EMDASH_ENCRYPTION_KEY=emdash_enc_v1_... pnpm start
```

En Cloudflare, guarda la variable como un secret del Worker y vuelve a desplegar:

```bash
npx emdash secrets generate
wrangler secret put EMDASH_ENCRYPTION_KEY
```

Conserva una copia de la clave en un gestor de secretos. Si se pierde, los valores cifrados de la base de datos no se pueden recuperar. Para rotarla, configura primero la clave nueva seguida de la anterior, despliega y conserva la anterior hasta que los valores existentes se hayan reescrito.

## Delivery

Cada zona de delivery contiene:

- Nombre.
- Distritos cubiertos.
- Costo.
- Tiempo estimado opcional.
- Estado activo o inactivo.

El cliente solo puede seleccionar zonas activas. El servidor toma el costo de la zona configurada y no acepta un costo enviado por el navegador.

## Clientes

Cada pedido registra un cliente en `_emdash_shop_customers` y relaciona el pedido mediante `customer_id`.

La tabla conserva:

- Nombre.
- Teléfono.
- Correo.
- Dirección.
- Distrito.
- Referencia.
- Notas.
- Fechas de creación y actualización.

El pedido también conserva una copia de los datos del cliente y del delivery. Esa copia mantiene la información histórica aunque los datos del cliente cambien después.

El panel administrativo puede mostrar cantidad de pedidos, total comprado, último pedido e historial de pedidos.

## Persistencia del pedido

El ecommerce utiliza estas tablas de Core:

| Tabla                         | Responsabilidad                              |
| ----------------------------- | -------------------------------------------- |
| `_emdash_shop_settings`       | Configuración de la tienda                   |
| `_emdash_shop_delivery_zones` | Zonas y costos de delivery                   |
| `_emdash_shop_customers`      | Datos registrados de clientes                |
| `_emdash_shop_orders`         | Cabecera y estados del pedido                |
| `_emdash_shop_order_items`    | Productos, variaciones, precios y cantidades |
| `_emdash_shop_payments`       | Método y estado del pago                     |
| `_emdash_shop_deliveries`     | Dirección y estado del delivery              |

Las migraciones `071_shop_orders`, `072_shop_payment_gateway` y `073_shop_currency_symbol` crean y amplían estas tablas; están registradas en el proveedor estático de migraciones de Core. El código ISO se conserva para integraciones y el símbolo configurado se utiliza en la tienda, el pedido y WhatsApp.

## APIs funcionales

### APIs públicas

- `GET /_emdash/api/shop/settings`: obtiene la configuración pública necesaria para el checkout.
- `GET /_emdash/api/shop/delivery-zones`: obtiene las zonas activas.
- `GET /_emdash/api/shop/products`: obtiene productos disponibles.
- `GET /_emdash/api/shop/products/:id`: obtiene un producto.
- `POST /_emdash/api/shop/orders`: crea un pedido.
- `GET /_emdash/api/shop/orders/:orderNumber`: consulta un pedido por número.

### APIs administrativas

- `GET /_emdash/api/admin/shop/settings`: consulta la configuración.
- `PUT /_emdash/api/admin/shop/settings`: actualiza la configuración.
- `GET /_emdash/api/admin/shop/delivery-zones`: lista zonas.
- `POST /_emdash/api/admin/shop/delivery-zones`: crea una zona.
- `PATCH /_emdash/api/admin/shop/delivery-zones/:id`: actualiza una zona.
- `DELETE /_emdash/api/admin/shop/delivery-zones/:id`: elimina una zona.
- `GET /_emdash/api/admin/shop/orders`: lista pedidos.
- `GET /_emdash/api/admin/shop/orders/:id`: obtiene el detalle de un pedido.
- `POST /_emdash/api/admin/shop/orders/:id/payment`: confirma el pago.
- `PATCH /_emdash/api/admin/shop/orders/:id/delivery`: actualiza el delivery.
- `GET /_emdash/api/admin/shop/customers`: lista clientes con resumen e historial.

Las operaciones administrativas requieren autenticación y el permiso `shop:read` o `shop:manage` según la operación.

La configuración de la pasarela solo está disponible mediante la API administrativa autenticada. La API pública no expone proveedor, entorno, URLs ni indicadores de secrets configurados.

## Errores funcionales

El frontend debe mostrar un mensaje comprensible y conservar los datos del formulario cuando ocurra uno de estos casos:

- El carrito está vacío.
- La zona de delivery no existe o está inactiva.
- El producto ya no existe.
- La variación ya no existe.
- El stock disponible es menor que la cantidad solicitada.
- Los datos del cliente están incompletos.
- No se puede cargar la configuración de la tienda.
- No se encuentra el número de pedido.
- El navegador no permite guardar datos localmente.

## Separación entre Core y frontend

Core contiene las migraciones, tipos, reglas de creación de pedidos, validaciones, APIs y componente base de tienda. El frontend decide la estructura de páginas, navegación, formularios, textos, layout, estilos y componentes visuales.

La demo simple contiene una implementación de referencia del catálogo, detalle de producto, carrito, checkout, confirmación, seguimiento y reutilización local de datos. Otro proyecto puede implementar esos flujos con una interfaz diferente mientras respete esta especificación.

La colección `products` y sus campos se cargan actualmente mediante el seed de la demo. Para una instalación reutilizable, se necesita un seed o configuración del ecommerce que registre esa colección y sus campos en cualquier proyecto nuevo.

## Criterios de aceptación

- Un producto sin variaciones permite agregar cantidad al carrito.
- Un producto con variaciones permite seleccionar cada opción habilitada.
- La selección de una variación actualiza su imagen, precio y stock cuando esos valores existen.
- Una variación sin precio o stock hereda el valor del producto base.
- El carrito permite editar cantidades y eliminar líneas.
- El checkout valida los datos obligatorios antes de crear el pedido.
- El servidor valida nuevamente precio, variación, stock y delivery.
- El pedido conserva los productos y precios usados en la compra.
- El cliente recibe un número de pedido y un enlace de WhatsApp.
- El seguimiento funciona con el número escrito con o sin `#`.
- El seguimiento muestra imágenes específicas de las variaciones cuando existen.
- El administrador puede consultar y filtrar pedidos y clientes.
- El administrador puede confirmar pagos y actualizar delivery.
- Los datos del cliente se pueden reutilizar o limpiar en el mismo navegador.
- La instalación ejecuta la migración ecommerce y crea todas las tablas requeridas.

## Trabajo posterior

La deduplicación de clientes por teléfono requiere una decisión separada sobre coincidencias, cambios de teléfono, privacidad, historial y migración de registros. No forma parte de esta fase.

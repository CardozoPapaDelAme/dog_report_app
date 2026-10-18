-- Demo data for the client demo around Creel, Chihuahua (see docs/DEMO_DATA.md).
--
-- Creates or refreshes 60 removable demo reports: 52 `visible` spread over the
-- last 29 days and 8 `pending_review` from the last 3 days. Every demo report id
-- starts with the marker `de300000-0000-4000-8000-`; scripts/demo-unseed.sql uses
-- that marker for one-shot removal.
--
-- Run as the database owner (Supabase SQL editor or psql as `postgres`). The
-- script is a single transaction and is idempotent: rerunning it rewrites the
-- same ids with dates relative to the new now(), clears demo flags, duplicate
-- candidates and duplicate resolutions, and keeps already uploaded demo photos
-- (their public purge deadline follows the refreshed public window).
--
-- Eight visible reports expect a photo. Their device fingerprint hash is
-- sha256('demo-creel-photo-uploader-2026'), the fixed fingerprint that
-- scripts/demo-photos.mjs sends as `X-Device-Fingerprint`.
--
-- Times are local to Creel (America/Chihuahua). Coordinates stay within ~6 km
-- of the town center (-107.6355, 27.7522).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.config_versions
    WHERE environment = app_private.current_environment() AND is_active
  ) THEN
    RAISE EXCEPTION 'demo-seed: no active config_versions row for the current environment';
  END IF;
END;
$$;

CREATE TEMP TABLE demo_seed_rows (
  n INTEGER PRIMARY KEY,
  day_offset INTEGER NOT NULL,      -- local calendar days before today (0 = today)
  local_time TIME,                  -- local time of day for day_offset >= 1
  minutes_ago INTEGER,              -- relative time for today's reports
  longitude DOUBLE PRECISION NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  gps_accuracy NUMERIC(7,2) NOT NULL,
  incident_type TEXT NOT NULL,
  sighting_type TEXT NOT NULL,
  color TEXT,
  size TEXT,
  collar BOOLEAN,
  sync_delay_minutes INTEGER NOT NULL,   -- client observation -> server sync
  review_delay_minutes INTEGER NOT NULL, -- sync -> administrator approval
  mode TEXT NOT NULL CHECK (mode IN ('auto', 'admin', 'pending', 'pendingLow')),
  trust_score NUMERIC(4,3) NOT NULL,
  photo_expected BOOLEAN NOT NULL,
  details JSONB NOT NULL,
  CHECK ((local_time IS NULL) <> (minutes_ago IS NULL))
) ON COMMIT DROP;

-- mode: auto = high trust auto-published; admin = medium trust approved by an
-- Administrator; pending / pendingLow = moderation queue (medium / low trust).
INSERT INTO demo_seed_rows (
  n, day_offset, local_time, minutes_ago, longitude, latitude, gps_accuracy,
  incident_type, sighting_type, color, size, collar, sync_delay_minutes,
  review_delay_minutes, mode, trust_score, photo_expected, details
) VALUES
  (1, 1, '08:10', NULL, -107.634395, 27.753040, 19.3, 'avistamiento_simple', 'solitario', 'café', 'mediano', FALSE, 4, 0, 'auto', 0.882, TRUE,
   '{"cantidad_aprox":1,"descripcion":"Perro café, flaco, caminando solo por la López Mateos casi enfrente de la plaza. Se metía entre los carros estacionados; no se ve agresivo."}'),
  (2, 1, '13:40', NULL, -107.619971, 27.739904, 9.2, 'avistamiento_simple', 'manada', 'negro', 'grande', FALSE, 10, 0, 'auto', 0.888, FALSE,
   '{"cantidad_aprox":4,"descripcion":"Cuatro perros juntos en el camino al Valle de los Hongos. Uno negro grande va adelante y les ladra a los turistas que pasan en cuatrimoto."}'),
  (3, 1, '19:25', NULL, -107.605091, 27.727912, 12.8, 'ataque_ganado', 'solitario', 'gris', 'grande', NULL, 28, 130, 'admin', 0.714, FALSE,
   '{"tipo_animal":"chivas","cantidad_afectada":2,"descripcion":"En un corral junto al camino al ejido de San Ignacio amanecieron dos chivas mordidas. Los vecinos vieron en la madrugada a unos perros grises rondando."}'),
  (4, 2, '07:55', NULL, -107.633686, 27.753093, 23.2, 'perro_lastimado', 'solitario', 'canela', 'mediano', FALSE, 9, 0, 'auto', 0.930, FALSE,
   '{"situacion":"atropellado","descripcion":"Perro canela atropellado a un lado de las vías, cerca de la estación del Chepe. Está vivo pero arrastra la pata trasera. Necesita que alguien lo recoja."}'),
  (5, 2, '16:20', NULL, -107.640381, 27.755924, 24.1, 'ataque_mascota', 'solitario', 'negro', 'mediano', TRUE, 9, 0, 'auto', 0.850, FALSE,
   '{"tipo_animal":"gato","resulto_herido":true,"descripcion":"Un perro negro con collar rojo persiguió y mordió a nuestro gato en el patio, subiendo hacia el Cristo Rey. El gato quedó lastimado de una pata."}'),
  (6, 3, '21:10', NULL, -107.635930, 27.752212, 6.9, 'avistamiento_simple', 'solitario', 'blanco', 'chico', FALSE, 8, 0, 'auto', 0.847, TRUE,
   '{"cantidad_aprox":1,"descripcion":"Perrito blanco sentado en la banqueta junto a un poste, en la calle de atrás del templo. Lleva varios días en la misma esquina; parece que alguien lo dejó."}'),
  (7, 4, '11:15', NULL, -107.619052, 27.732839, 6.3, 'avistamiento_simple', 'manada', 'café con blanco', 'mediano', FALSE, 6, 0, 'auto', 0.956, FALSE,
   '{"cantidad_aprox":3,"descripcion":"Tres perros echados en la entrada de la Misión de San Ignacio. Les piden comida a los visitantes y uno trae el lomo pelón, como con sarna."}'),
  (8, 4, '17:45', NULL, -107.627303, 27.765920, 18.6, 'ataque_humano', 'solitario', 'atigrado', 'grande', FALSE, 3, 108, 'admin', 0.758, FALSE,
   '{"hubo_mordida":false,"descripcion":"Un perro atigrado grande se le aventó a un señor que iba caminando por la carretera, a la salida rumbo a San Juanito. No lo alcanzó a morder, pero sí lo correteó un buen tramo."}'),
  (9, 4, '20:05', NULL, -107.638826, 27.747155, 18.8, 'avistamiento_simple', 'solitario', 'negro', 'grande', NULL, 7, 0, 'auto', 0.887, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perro negro grande echado en la entrada del panteón. Ya estaba oscureciendo y no se alcanzó a ver si traía collar."}'),
  (10, 5, '08:40', NULL, -107.632558, 27.745328, 16.7, 'perro_lastimado', 'solitario', 'café con blanco', 'mediano', FALSE, 4, 0, 'auto', 0.933, TRUE,
   '{"situacion":"mal_estado","descripcion":"Perrita café con blanco recargada en la barda de piedra, por la salida a San Ignacio. Se ve muy flaca y casi no se mueve. Le dejamos agua y unas tortillas."}'),
  (11, 5, '14:00', NULL, -107.611494, 27.713468, 12.7, 'avistamiento_simple', 'manada', 'manchado', 'mediano', FALSE, 35, 185, 'admin', 0.641, FALSE,
   '{"cantidad_aprox":6,"descripcion":"Unos seis perros cerca de la orilla del Lago Arareko, donde rentan las lanchas. Se acercan a las mesas a buscar comida y algunos niños se asustaron."}'),
  (12, 6, '10:20', NULL, -107.624610, 27.727273, 8.0, 'ataque_ganado', 'solitario', 'café', 'grande', FALSE, 27, 152, 'admin', 0.585, FALSE,
   '{"tipo_animal":"becerro","cantidad_afectada":1,"descripcion":"Encontramos un becerro mordido en el potrero a la orilla de la carretera a Cusárare. Hay huellas de perro alrededor y se vio una perra café grande en la zona."}'),
  (13, 6, '18:30', NULL, -107.636546, 27.751943, 8.3, 'otro', 'solitario', 'gris', 'mediano', TRUE, 8, 0, 'auto', 0.936, FALSE,
   '{"descripcion":"Un perro gris con collar se mete a la tienda de abarrotes de junto a la plaza y saca las bolsas de basura. No es agresivo, pero ya rompió varias."}'),
  (14, 8, '07:20', NULL, -107.645725, 27.750850, 22.5, 'avistamiento_simple', 'solitario', 'amarillo', 'mediano', FALSE, 7, 0, 'auto', 0.819, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perro amarillo cruzando la calle a la altura de la secundaria, en la parte alta del pueblo. Cojeaba un poco pero caminaba bien."}'),
  (15, 8, '12:50', NULL, -107.621303, 27.741415, 18.6, 'ataque_mascota', 'manada', 'negro', 'grande', FALSE, 10, 201, 'admin', 0.685, FALSE,
   '{"tipo_animal":"perro","resulto_herido":true,"descripcion":"Dos perros callejeros atacaron a mi perrita en el camino al Valle de las Ranas. Le mordieron el cuello y la tuvimos que llevar al veterinario."}'),
  (16, 8, '19:15', NULL, -107.634903, 27.754338, 8.1, 'avistamiento_simple', 'manada', 'café con blanco', 'mediano', FALSE, 5, 0, 'auto', 0.838, TRUE,
   '{"cantidad_aprox":2,"descripcion":"Dos perros en la calle empedrada junto a la vía: uno se estiraba y el otro estaba echado. Están ahí casi todas las tardes."}'),
  (17, 9, '09:05', NULL, -107.635716, 27.750781, 18.3, 'perro_lastimado', 'solitario', 'blanco', 'grande', FALSE, 10, 0, 'auto', 0.900, TRUE,
   '{"situacion":"herido","descripcion":"Perro blanco echado en el callejón que baja de la López Mateos hacia la vía. Tiene una herida en la pata delantera y no se quiere levantar. Está tranquilo, no gruñe."}'),
  (18, 9, '15:35', NULL, -107.649839, 27.743042, 16.4, 'ataque_ganado', 'manada', 'negro', 'grande', NULL, 19, 238, 'admin', 0.647, FALSE,
   '{"tipo_animal":"borregos","cantidad_afectada":3,"descripcion":"Tres borregos muertos en un potrero del lado poniente del pueblo. El dueño dice que fue una jauría de perros negros que baja del cerro en la noche."}'),
  (19, 10, '08:00', NULL, -107.628775, 27.765185, 17.3, 'avistamiento_simple', 'solitario', 'gris', 'mediano', TRUE, 6, 0, 'auto', 0.844, TRUE,
   '{"cantidad_aprox":1,"descripcion":"Perro gris con collar dormido junto a un escalón en la entrada norte, por las cabañas. Se ve bien cuidado; a lo mejor tiene dueño pero anda suelto."}'),
  (20, 10, '13:10', NULL, -107.635510, 27.753870, 9.3, 'ataque_humano', 'solitario', 'café', 'mediano', FALSE, 3, 184, 'admin', 0.579, FALSE,
   '{"hubo_mordida":true,"descripcion":"Un perro café mordió a una niña en la pierna a la salida de la escuela, en la calle de atrás del templo de Cristo Rey. La llevaron al centro de salud; el perro sigue en la cuadra."}'),
  (21, 11, '10:45', NULL, -107.620930, 27.741550, 11.1, 'avistamiento_simple', 'solitario', 'café con blanco', 'chico', FALSE, 7, 0, 'auto', 0.904, TRUE,
   '{"cantidad_aprox":1,"descripcion":"Cachorro café con blanco solito en el camino de tierra hacia el Valle de los Hongos, entre las hojas secas. Está muy chiquito para andar solo."}'),
  (22, 11, '17:20', NULL, -107.613280, 27.713560, 24.7, 'avistamiento_simple', 'manada', 'negro', 'mediano', FALSE, 21, 0, 'auto', 0.919, FALSE,
   '{"cantidad_aprox":3,"descripcion":"Tres perros negros siguiendo a los turistas en el sendero alrededor del Lago Arareko. Nada más ladran, pero la gente se pone nerviosa."}'),
  (23, 12, '07:45', NULL, -107.605222, 27.729456, 5.2, 'ataque_ganado', 'manada', 'atigrado', 'mediano', FALSE, 40, 0, 'auto', 0.833, FALSE,
   '{"tipo_animal":"gallinas","cantidad_afectada":8,"descripcion":"Se metieron perros al gallinero en el ejido de San Ignacio y mataron ocho gallinas. Uno era atigrado; a los demás no se les alcanzó a ver bien."}'),
  (24, 12, '21:30', NULL, -107.636799, 27.752354, 15.0, 'ataque_mascota', 'solitario', 'blanco', 'grande', TRUE, 3, 0, 'auto', 0.902, FALSE,
   '{"tipo_animal":"gato","resulto_herido":false,"descripcion":"Perro blanco grande con collar persiguiendo gatos en la calle de las cabañas, cerca de la vía. Ya van varias noches que se oyen los pleitos."}'),
  (25, 13, '09:50', NULL, -107.642292, 27.756404, 17.1, 'avistamiento_simple', 'manada', 'manchado', 'mediano', FALSE, 5, 0, 'auto', 0.955, TRUE,
   '{"cantidad_aprox":5,"descripcion":"Una manada de cinco perros (negros, uno blanco con negro y uno café) peleándose por comida en la subida al mirador del Cristo Rey."}'),
  (26, 13, '16:05', NULL, -107.632158, 27.746439, 23.3, 'avistamiento_simple', 'solitario', 'negro', 'chico', FALSE, 6, 0, 'auto', 0.946, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perrita negra chiquita, al parecer preñada, buscando comida en los botes de basura de la salida a San Ignacio."}'),
  (27, 14, '11:30', NULL, -107.635436, 27.754042, 15.1, 'perro_lastimado', 'solitario', 'café', 'mediano', TRUE, 5, 158, 'admin', 0.596, FALSE,
   '{"situacion":"atrapado","descripcion":"Hay un perro café atorado entre la malla y los durmientes, del lado norte de la estación. Ya les avisamos a los del ferrocarril, pero sigue ahí."}'),
  (28, 15, '08:25', NULL, -107.643804, 27.750303, 10.9, 'ataque_mascota', 'solitario', 'atigrado', 'grande', FALSE, 2, 0, 'auto', 0.880, FALSE,
   '{"tipo_animal":"perro","resulto_herido":false,"descripcion":"Un perro atigrado se peleó con el perro de mi vecino en la calle de arriba, por el tanque de agua. Los separamos a tiempo y no pasó a mayores."}'),
  (29, 15, '18:55', NULL, -107.615526, 27.735469, 21.0, 'avistamiento_simple', 'manada', 'gris', 'grande', FALSE, 34, 0, 'auto', 0.836, FALSE,
   '{"cantidad_aprox":2,"descripcion":"Dos perros grises grandes rondando el estacionamiento de la cueva de Sebastián. Se les acercan mucho a los niños."}'),
  (30, 17, '10:10', NULL, -107.636428, 27.753223, 15.1, 'ataque_humano', 'solitario', 'negro', 'mediano', FALSE, 4, 0, 'auto', 0.849, FALSE,
   '{"hubo_mordida":true,"descripcion":"Un perro negro mordió en la mano a un turista que le quiso dar de comer, frente a los puestos de artesanías de la plaza. Lo atendieron en la Cruz Roja."}'),
  (31, 17, '15:45', NULL, -107.619866, 27.740976, 13.7, 'perro_lastimado', 'solitario', 'canela', 'mediano', FALSE, 10, 0, 'auto', 0.863, FALSE,
   '{"situacion":"mal_estado","descripcion":"Perra canela muy flaca y con sarna, echada bajo un pino cerca del Valle de los Hongos. Parece que tiene cachorros escondidos entre las piedras."}'),
  (32, 18, '07:35', NULL, -107.638987, 27.746005, 18.4, 'avistamiento_simple', 'solitario', 'café', 'grande', FALSE, 5, 0, 'auto', 0.886, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perro café grande caminando entre las tumbas del panteón temprano en la mañana. Se fue rumbo al cerro."}'),
  (33, 18, '13:20', NULL, -107.611880, 27.714439, 9.9, 'otro', 'solitario', 'blanco', 'mediano', NULL, 26, 167, 'admin', 0.691, FALSE,
   '{"descripcion":"Una perra blanca siempre está echada en el estacionamiento del Lago Arareko. La gente le da de comer y ya se están juntando más perros; sería bueno que alguien la revisara."}'),
  (34, 18, '20:40', NULL, -107.627378, 27.765112, 5.6, 'avistamiento_simple', 'manada', 'café', 'mediano', FALSE, 10, 0, 'auto', 0.845, FALSE,
   '{"cantidad_aprox":4,"descripcion":"Cuatro perros cafés cruzando la carretera de noche en la entrada a Creel. Casi los atropella una camioneta."}'),
  (35, 19, '09:15', NULL, -107.651888, 27.741364, 9.4, 'ataque_ganado', 'manada', 'negro', 'grande', FALSE, 31, 179, 'admin', 0.620, FALSE,
   '{"tipo_animal":"vaca","cantidad_afectada":1,"descripcion":"Una vaca con mordidas en las patas traseras en un potrero del poniente. Fueron tres perros; uno negro muy grande."}'),
  (36, 20, '11:50', NULL, -107.620948, 27.732913, 13.7, 'avistamiento_simple', 'solitario', 'blanco', 'mediano', TRUE, 6, 0, 'auto', 0.905, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perro blanco con collar azul echado afuera de la Misión de San Ignacio. Parece que es de alguien de la comunidad."}'),
  (37, 20, '17:30', NULL, -107.631797, 27.745341, 17.7, 'ataque_mascota', 'manada', 'café', 'grande', FALSE, 3, 0, 'auto', 0.832, FALSE,
   '{"tipo_animal":"perro","resulto_herido":true,"descripcion":"Dos perros callejeros mordieron a mi perro afuera de la casa, por la salida a San Ignacio. Le dejaron una herida en la oreja."}'),
  (38, 21, '08:45', NULL, -107.625812, 27.725393, 14.1, 'avistamiento_simple', 'manada', 'café con negro', 'grande', FALSE, 35, 196, 'admin', 0.693, FALSE,
   '{"cantidad_aprox":7,"descripcion":"Como siete perros juntos a la orilla de la carretera a Cusárare, pasando el entronque al lago. Se les echan a los carros que pasan despacio."}'),
  (39, 21, '14:25', NULL, -107.635280, 27.752697, 6.1, 'perro_lastimado', 'solitario', 'negro', 'chico', FALSE, 6, 0, 'auto', 0.840, FALSE,
   '{"situacion":"atropellado","descripcion":"Perrito negro atropellado en la López Mateos frente a la gasolinera. Una señora lo movió a la banqueta; sigue respirando."}'),
  (40, 22, '10:30', NULL, -107.637606, 27.752901, 22.4, 'avistamiento_simple', 'solitario', 'canela', 'mediano', FALSE, 5, 0, 'auto', 0.844, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perra canela durmiendo en las escaleras del templo. Se ve sana, pero ya lleva varios días ahí."}'),
  (41, 23, '16:10', NULL, -107.605327, 27.728851, 11.2, 'ataque_ganado', 'manada', 'gris', 'mediano', NULL, 39, 0, 'auto', 0.851, FALSE,
   '{"tipo_animal":"chivas","cantidad_afectada":4,"descripcion":"Otra vez atacaron las chivas en el ejido; ahora fueron cuatro. Los perros vienen del lado del arroyo."}'),
  (42, 24, '07:50', NULL, -107.633424, 27.754765, 5.3, 'avistamiento_simple', 'manada', 'negro', 'mediano', FALSE, 6, 0, 'auto', 0.849, FALSE,
   '{"cantidad_aprox":3,"descripcion":"Tres perros negros esperando el tren en la estación. Cuando baja la gente se acercan a pedir comida, y uno le ladró a una señora."}'),
  (43, 24, '12:40', NULL, -107.643380, 27.750990, 7.2, 'ataque_humano', 'solitario', 'café con blanco', 'grande', FALSE, 2, 66, 'admin', 0.648, FALSE,
   '{"hubo_mordida":true,"descripcion":"A mi hijo lo mordió en el tobillo un perro café con blanco cuando iba en bicicleta por la colonia de arriba. Ya le pusieron la vacuna."}'),
  (44, 24, '19:05', NULL, -107.611928, 27.713542, 5.6, 'avistamiento_simple', 'solitario', 'gris', 'grande', FALSE, 27, 0, 'auto', 0.847, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perro gris grande, tipo pastor, caminando solo por la orilla del Lago Arareko al atardecer."}'),
  (45, 25, '09:40', NULL, -107.642660, 27.756708, 5.7, 'ataque_mascota', 'solitario', 'café', 'mediano', FALSE, 10, 0, 'auto', 0.833, FALSE,
   '{"tipo_animal":"gato","resulto_herido":false,"descripcion":"Un perro café acorraló a un gato en el techo de una casa, subiendo al mirador. El gato alcanzó a escaparse."}'),
  (46, 26, '13:55', NULL, -107.621235, 27.741051, 17.3, 'avistamiento_simple', 'manada', 'blanco', 'mediano', FALSE, 9, 0, 'auto', 0.873, FALSE,
   '{"cantidad_aprox":2,"descripcion":"Dos perros blancos jugando y persiguiendo a las vacas en el camino a los valles."}'),
  (47, 27, '08:15', NULL, -107.637747, 27.751235, 21.9, 'otro', 'solitario', 'negro', 'grande', FALSE, 4, 0, 'auto', 0.911, FALSE,
   '{"descripcion":"Un perro negro grande se duerme todas las noches en la entrada del cajero, junto a la vía. No hace nada, pero la gente ya no quiere entrar."}'),
  (48, 27, '17:40', NULL, -107.619592, 27.732897, 21.8, 'perro_lastimado', 'solitario', 'amarillo', 'mediano', FALSE, 9, 0, 'auto', 0.922, FALSE,
   '{"situacion":"herido","descripcion":"Perro amarillo con una herida en el lomo, como de pelea, caminando por el camino a la Misión de San Ignacio."}'),
  (49, 28, '10:05', NULL, -107.628096, 27.765867, 21.9, 'ataque_mascota', 'solitario', 'negro', 'grande', TRUE, 6, 0, 'auto', 0.840, FALSE,
   '{"tipo_animal":"perro","resulto_herido":true,"descripcion":"Un perro negro con collar atacó al perro de un turista en el estacionamiento de las cabañas de la entrada norte. Los tuvieron que separar con una cobija."}'),
  (50, 28, '15:20', NULL, -107.625360, 27.726594, 6.3, 'avistamiento_simple', 'manada', 'atigrado', 'mediano', FALSE, 30, 0, 'auto', 0.838, FALSE,
   '{"cantidad_aprox":3,"descripcion":"Tres perros, uno de ellos atigrado, cruzando el arroyo junto a la carretera a Cusárare."}'),
  (51, 29, '09:25', NULL, -107.640859, 27.746424, 24.8, 'perro_lastimado', 'solitario', 'blanco', 'chico', FALSE, 2, 0, 'auto', 0.838, FALSE,
   '{"situacion":"mal_estado","descripcion":"Perrito blanco temblando de frío debajo de una camioneta, por el panteón. Se ve desnutrido."}'),
  (52, 29, '16:45', NULL, -107.652348, 27.740712, 5.7, 'avistamiento_simple', 'solitario', 'café', 'mediano', NULL, 21, 0, 'auto', 0.811, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perro café solo en un potrero del poniente, a lo lejos. No se acercó."}'),
  (53, 0, NULL, 35, -107.634733, 27.752416, 7.8, 'avistamiento_simple', 'solitario', 'café', 'chico', FALSE, 3, 0, 'pending', 0.628, FALSE,
   '{"cantidad_aprox":1,"descripcion":"Perrito café chico corriendo entre los puestos de la plaza; se ve asustado."}'),
  (54, 0, NULL, 150, -107.612227, 27.714285, 14.4, 'ataque_mascota', 'solitario', 'negro', 'grande', FALSE, 43, 0, 'pending', 0.628, FALSE,
   '{"tipo_animal":"perro","resulto_herido":true,"descripcion":"Un perro negro grande mordió a nuestra perrita en el sendero del Lago Arareko. Le sangra un poco la pata."}'),
  (55, 0, NULL, 290, -107.626167, 27.764110, 23.5, 'ataque_humano', 'solitario', 'atigrado', 'grande', FALSE, 10, 0, 'pendingLow', 0.402, FALSE,
   '{"hubo_mordida":true,"descripcion":"Me mordió en la pantorrilla un perro atigrado mientras caminaba por la carretera, en la entrada norte. Voy al centro de salud."}'),
  (56, 1, '10:50', NULL, -107.621199, 27.733273, 12.8, 'avistamiento_simple', 'manada', 'manchado', 'mediano', FALSE, 3, 0, 'pending', 0.552, FALSE,
   '{"cantidad_aprox":5,"descripcion":"Cinco perros siguiendo a un grupo de turistas a caballo cerca de San Ignacio. Los caballos se espantaron."}'),
  (57, 1, '18:35', NULL, -107.644127, 27.750529, 18.4, 'perro_lastimado', 'solitario', 'canela', 'mediano', TRUE, 7, 0, 'pending', 0.616, FALSE,
   '{"situacion":"atrapado","descripcion":"Una perra canela con collar se quedó atrapada en un tejabán abandonado en la parte alta de la colonia. Se oye cómo llora."}'),
  (58, 2, '09:10', NULL, -107.604593, 27.727860, 6.4, 'ataque_ganado', 'solitario', 'café', 'grande', NULL, 47, 0, 'pendingLow', 0.376, FALSE,
   '{"tipo_animal":"borrego","cantidad_afectada":1,"descripcion":"Un borrego mordido en el corral. Creemos que fue un perro café que anda suelto por el ejido."}'),
  (59, 2, '15:55', NULL, -107.619985, 27.740587, 24.0, 'ataque_mascota', 'solitario', 'blanco', 'mediano', FALSE, 11, 0, 'pending', 0.654, FALSE,
   '{"tipo_animal":"gato","resulto_herido":false,"descripcion":"Un perro blanco persiguió a un gato hasta un árbol en la entrada al Valle de los Hongos."}'),
  (60, 3, '12:30', NULL, -107.636097, 27.751305, 5.5, 'otro', 'solitario', 'gris', 'mediano', FALSE, 2, 0, 'pending', 0.634, FALSE,
   '{"descripcion":"Hay muchos perros durmiendo afuera del mercado y se pelean cuando les tiran comida. Alguien debería revisar."}');

-- Reset moderation side effects left on demo reports by a previous run or demo.
DELETE FROM public.report_flags
WHERE report_id::text LIKE 'de300000-0000-4000-8000-%';
DELETE FROM public.duplicate_candidates
WHERE report_a::text LIKE 'de300000-0000-4000-8000-%'
   OR report_b::text LIKE 'de300000-0000-4000-8000-%';
DELETE FROM public.duplicate_memberships
WHERE report_id::text LIKE 'de300000-0000-4000-8000-%';
DELETE FROM public.duplicate_groups
WHERE canonical_report_id::text LIKE 'de300000-0000-4000-8000-%';

WITH cfg AS (
  SELECT id, public_retention_days, fingerprint_retention_days
  FROM public.config_versions
  WHERE environment = app_private.current_environment() AND is_active
),
timed AS (
  SELECT
    s.*,
    CASE
      WHEN s.minutes_ago IS NOT NULL THEN now() - make_interval(mins => s.minutes_ago)
      ELSE (
        date_trunc('day', now() AT TIME ZONE 'America/Chihuahua')
        - make_interval(days => s.day_offset) + s.local_time
      ) AT TIME ZONE 'America/Chihuahua'
    END AS observed_at
  FROM demo_seed_rows s
),
synced AS (
  SELECT
    t.*,
    LEAST(t.observed_at + make_interval(mins => t.sync_delay_minutes), now() - interval '1 minute') AS synced_at
  FROM timed t
),
staged AS (
  SELECT
    s.*,
    CASE s.mode
      WHEN 'auto' THEN s.synced_at
      WHEN 'admin' THEN LEAST(s.synced_at + make_interval(mins => s.review_delay_minutes), now() - interval '1 minute')
    END AS accepted_at
  FROM synced s
)
INSERT INTO public.reports (
  id, submission_hash, location, gps_accuracy_meters, mock_location_suspected,
  incident_type, sighting_type, details, color_predominante, tamano, tiene_collar,
  photo_expected, client_photo_check_passed, honeypot_suspected,
  status, status_reason, previous_status, trust_tier, trust_score, trust_config_id,
  photo_validation_score, exif_consistency_score, gps_trust_score, fingerprint_trust_score,
  device_fingerprint_hash, fingerprint_expires_at,
  client_created_at, synced_at, accepted_at, published_at, public_until,
  hidden_at, deleted_at, flag_reviewed_at
)
SELECT
  ('de300000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
  encode(sha256(convert_to('demo-seed-submission-' || s.n, 'UTF8')), 'hex'),
  extensions.ST_SetSRID(extensions.ST_MakePoint(s.longitude, s.latitude), 4326)::extensions.geography,
  s.gps_accuracy,
  FALSE,
  s.incident_type::public.incident_type,
  s.sighting_type::public.sighting_type,
  s.details,
  s.color,
  s.size::public.dog_size,
  s.collar,
  s.photo_expected,
  CASE WHEN s.photo_expected THEN TRUE END,
  FALSE,
  (CASE WHEN s.mode IN ('auto', 'admin') THEN 'visible' ELSE 'pending_review' END)::public.report_status,
  (CASE s.mode
     WHEN 'auto' THEN 'high_trust_auto_publish'
     WHEN 'admin' THEN 'administrator_approved'
     ELSE 'medium_or_low_trust'
   END)::public.report_status_reason,
  NULL,
  (CASE s.mode
     WHEN 'auto' THEN 'high'
     WHEN 'pendingLow' THEN 'low'
     ELSE 'medium'
   END)::public.trust_tier,
  s.trust_score,
  cfg.id,
  NULL,
  NULL,
  round(1 - s.gps_accuracy / 120, 3),
  round(0.6 + (s.n % 4) * 0.1, 3),
  CASE
    WHEN s.photo_expected
      THEN encode(sha256(convert_to('demo-creel-photo-uploader-2026', 'UTF8')), 'hex')
    ELSE encode(sha256(convert_to('demo-creel-device-' || s.n, 'UTF8')), 'hex')
  END,
  s.synced_at + make_interval(days => cfg.fingerprint_retention_days),
  s.observed_at,
  s.synced_at,
  s.accepted_at,
  s.accepted_at,
  s.accepted_at + make_interval(days => cfg.public_retention_days),
  NULL,
  NULL,
  NULL
FROM staged s
CROSS JOIN cfg
ORDER BY s.observed_at
ON CONFLICT (id) DO UPDATE SET
  submission_hash = EXCLUDED.submission_hash,
  location = EXCLUDED.location,
  gps_accuracy_meters = EXCLUDED.gps_accuracy_meters,
  mock_location_suspected = EXCLUDED.mock_location_suspected,
  incident_type = EXCLUDED.incident_type,
  sighting_type = EXCLUDED.sighting_type,
  details = EXCLUDED.details,
  color_predominante = EXCLUDED.color_predominante,
  tamano = EXCLUDED.tamano,
  tiene_collar = EXCLUDED.tiene_collar,
  photo_expected = EXCLUDED.photo_expected,
  client_photo_check_passed = EXCLUDED.client_photo_check_passed,
  honeypot_suspected = EXCLUDED.honeypot_suspected,
  status = EXCLUDED.status,
  status_reason = EXCLUDED.status_reason,
  previous_status = EXCLUDED.previous_status,
  trust_tier = EXCLUDED.trust_tier,
  trust_score = EXCLUDED.trust_score,
  trust_config_id = EXCLUDED.trust_config_id,
  photo_validation_score = EXCLUDED.photo_validation_score,
  exif_consistency_score = EXCLUDED.exif_consistency_score,
  gps_trust_score = EXCLUDED.gps_trust_score,
  fingerprint_trust_score = EXCLUDED.fingerprint_trust_score,
  device_fingerprint_hash = EXCLUDED.device_fingerprint_hash,
  fingerprint_expires_at = EXCLUDED.fingerprint_expires_at,
  client_created_at = EXCLUDED.client_created_at,
  synced_at = EXCLUDED.synced_at,
  accepted_at = EXCLUDED.accepted_at,
  published_at = EXCLUDED.published_at,
  public_until = EXCLUDED.public_until,
  hidden_at = EXCLUDED.hidden_at,
  deleted_at = EXCLUDED.deleted_at,
  flag_reviewed_at = EXCLUDED.flag_reviewed_at;

-- Keep uploaded demo photos aligned with the refreshed public window, exactly as
-- the photo approval flow does (purge_after = public_until).
UPDATE public.photo_assets pa
SET purge_after = r.public_until
FROM public.reports r
WHERE r.id = pa.report_id
  AND pa.report_id::text LIKE 'de300000-0000-4000-8000-%'
  AND pa.state = 'approved'
  AND r.public_until IS NOT NULL;

-- Summary: expect visible = 52 and pending_review = 8.
SELECT status, count(*) AS reports
FROM public.reports
WHERE id::text LIKE 'de300000-0000-4000-8000-%'
GROUP BY status
ORDER BY status;

COMMIT;

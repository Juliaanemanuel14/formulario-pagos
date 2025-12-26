-- =====================================================
-- CREAR ROL ADMIN_TESORERIA (Nivel 8)
-- =====================================================
-- Admin Tesorería tendrá acceso a:
-- - Todo lo que tiene tesorería (nivel 7)
-- - Auditoría de diferencias
-- - Marcar diferencias como OK
-- - Reportes de auditoría
-- =====================================================

-- PASO 1: Crear el rol "admin_tesoreria" en la tabla roles
INSERT INTO roles (name, level, description)
VALUES ('admin_tesoreria', 8, 'Admin Tesorería - Auditoría y aprobación de diferencias')
ON DUPLICATE KEY UPDATE
    level = 8,
    description = 'Admin Tesorería - Auditoría y aprobación de diferencias';

-- PASO 2: Verificar que se creó el rol
SELECT id, name, level, description FROM roles WHERE name = 'admin_tesoreria';

-- PASO 3: Crear usuario admin de tesorería
-- IMPORTANTE: Reemplaza 'admin.tesoreria' y 'password_seguro' con valores reales

-- Obtener el role_id
SET @role_id = (SELECT id FROM roles WHERE name = 'admin_tesoreria' LIMIT 1);

-- Crear el usuario
INSERT INTO users (username, password, role_id, local, society, status, first_login, created_at)
VALUES (
    'admin.tesoreria',             -- Username (cambiar)
    'password_seguro',             -- Password temporal (cambiar)
    @role_id,                      -- Role ID de admin_tesoreria
    'TESORERIA',                   -- Local
    'TODOS',                       -- Society
    'active',                      -- Estado
    1,                             -- Primer login (fuerza cambio de password)
    NOW()                          -- Fecha de creación
);

-- PASO 4: Verificar que se creó correctamente
SELECT
    u.id,
    u.username,
    u.local,
    u.society,
    u.status,
    r.name AS role_name,
    r.level AS role_level
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.username = 'admin.tesoreria';

-- =====================================================
-- RESUMEN DE NIVELES ACTUALIZADO
-- =====================================================
-- 1 = cajero              -> /index
-- 2 = encargado           -> /encargado
-- 3 = auditor             -> /auditor
-- 4 = anticipos           -> /gestion-anticipos
-- 5 = jefe_auditor        -> /auditor
-- 6 = admin_anticipos     -> /gestion-anticipos (+ gestión de usuarios de tesorería)
-- 7 = tesoreria           -> /tesoreria (solo contabilización)
-- 8 = admin_tesoreria     -> /tesoreria (contabilización + auditoría)
-- =====================================================

-- =====================================================
-- EJEMPLO COMPLETO (Paso a Paso)
-- =====================================================

-- 1. Crear rol
INSERT INTO roles (name, level, description)
VALUES ('admin_tesoreria', 8, 'Admin Tesorería - Auditoría y aprobación de diferencias')
ON DUPLICATE KEY UPDATE level = 8;

-- 2. Ver el role_id
SELECT id, name, level FROM roles WHERE name = 'admin_tesoreria';
-- Supongamos que devuelve id = 12

-- 3. Crear usuario (reemplazar role_id con el valor obtenido)
INSERT INTO users (username, password, role_id, local, society, status, first_login)
VALUES ('admin.tesoreria', 'ChangeMe123', 12, 'TESORERIA', 'TODOS', 'active', 1);

-- 4. Verificar
SELECT u.username, r.name AS rol, r.level
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.username = 'admin.tesoreria';

-- =====================================================
-- VER TODOS LOS USUARIOS DE TESORERÍA
-- =====================================================
SELECT
    u.id,
    u.username,
    u.local,
    u.status,
    r.name AS rol,
    r.level,
    u.created_at
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name IN ('tesoreria', 'admin_tesoreria')
ORDER BY r.level DESC, u.created_at DESC;

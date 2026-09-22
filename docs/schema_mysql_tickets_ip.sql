-- ========================================================================
-- SISTEMA DE GESTIÓN Y DISTRIBUCIÓN DE TICKETS HELPDESK IP (INTER FTTH)
-- ESQUEMA RELACIONAL PARA MYSQL / MARIADB CON INTEGRIDAD REFERENCIAL
-- Basado en: docs/feature_control_correos.md
-- ========================================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS ticket_historial_estados;
DROP TABLE IF EXISTS ticket_adjuntos;
DROP TABLE IF EXISTS email_tickets;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departamentos;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------
-- 1. TABLA: departamentos
-- Las 6 unidades técnicas oficiales del departamento IP de Inter
-- ------------------------------------------------------------------------
CREATE TABLE departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(32) NOT NULL UNIQUE,
    nombre VARCHAR(128) NOT NULL,
    descripcion TEXT NULL,
    color_hex VARCHAR(16) DEFAULT '#1C58A8',
    icono VARCHAR(32) DEFAULT 'folder',
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 2. TABLA: users (Operadores y Especialistas Técnicos)
-- ------------------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    departamento_id INT NULL,
    area VARCHAR(50) DEFAULT 'Soporte',
    role VARCHAR(50) DEFAULT 'Especialista',
    avatar VARCHAR(8) DEFAULT 'IP',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_departamento 
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 3. TABLA: email_tickets (Casos / Requerimientos Técnicos)
-- Control de tiempos: creación, inicio de atención, cierre y SLAs
-- ------------------------------------------------------------------------
CREATE TABLE email_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_code VARCHAR(32) NOT NULL UNIQUE,
    sender_email VARCHAR(120) NOT NULL,
    recipient_email VARCHAR(120) DEFAULT 'operaciones@inter.com.ve',
    subject VARCHAR(255) NOT NULL,
    full_body LONGTEXT NOT NULL,
    
    -- Clasificación Departamental y Operador Asignado
    departamento_id INT NOT NULL,
    operador_id INT NULL,
    area VARCHAR(50) DEFAULT 'Acceso',
    
    -- Parámetros Técnicos de Red FTTH / OLT / IP
    subscriber_code VARCHAR(32) NULL,
    serial_pon VARCHAR(32) NULL,
    node_name VARCHAR(64) NULL,
    slot_pon VARCHAR(32) NULL,
    mac_address VARCHAR(32) NULL,
    task_code VARCHAR(32) NULL,
    suggested_task_name VARCHAR(128) NULL,
    suggested_points INT DEFAULT 1,
    sla_minutes INT DEFAULT 45,
    
    -- Ciclo de Vida y Tiempos de Atención
    status ENUM('PENDIENTE', 'EN PROGRESO', 'EN ESPERA', 'POR_VERIFICAR', 'COMPLETADO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio_atencion TIMESTAMP NULL,
    fecha_cierre TIMESTAMP NULL,
    duracion_atencion_minutos INT DEFAULT 0,
    tiempo_espera_minutos INT DEFAULT 0,
    
    -- Pausas y Seguimiento en Vivo
    paused_at TIMESTAMP NULL,
    total_paused_seconds INT DEFAULT 0,
    folder VARCHAR(32) DEFAULT 'inbox',
    source VARCHAR(32) DEFAULT 'SIMULATOR',
    
    -- Índices para búsqueda rápida en consola
    INDEX idx_tickets_depto (departamento_id),
    INDEX idx_tickets_operador (operador_id),
    INDEX idx_tickets_status (status),
    INDEX idx_tickets_fecha_creacion (fecha_creacion),
    
    -- Claves Foráneas
    CONSTRAINT fk_tickets_departamento 
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_tickets_operador 
        FOREIGN KEY (operador_id) REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 4. TABLA: ticket_historial_estados (Auditoría Forense Inmutable)
-- Registra cada cambio de estado, operador responsable y notas
-- ------------------------------------------------------------------------
CREATE TABLE ticket_historial_estados (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    operador_id INT NULL,
    estado_anterior VARCHAR(32) NULL,
    estado_nuevo VARCHAR(32) NOT NULL,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas_o_detalles TEXT NULL,
    
    INDEX idx_historial_ticket (ticket_id),
    INDEX idx_historial_operador (operador_id),
    INDEX idx_historial_fecha (fecha_cambio),
    
    CONSTRAINT fk_historial_ticket 
        FOREIGN KEY (ticket_id) REFERENCES email_tickets(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_historial_operador 
        FOREIGN KEY (operador_id) REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- SEED DATA: Los 6 Departamentos Oficiales de Operaciones IP
-- ------------------------------------------------------------------------
INSERT INTO departamentos (codigo, nombre, descripcion, color_hex, icono) VALUES
('ACCESO_APROV', 'Redes de Acceso y Aprovisionamiento', 'Soporte FTTH, OLT, ONTs, bridge, aprov y cortes/recon', '#0056B3', 'network'),
('TRAFICO_INALAMBRICO', 'Control de Tráfico e Redes Inalámbricas', 'Enlaces de microondas, radioenlaces, QoS, ruteo wireless', '#D97706', 'radio'),
('SEGURIDAD', 'Seguridad', 'Políticas de firewall, mitigación DDoS, filtrado y aislamiento', '#DC2626', 'shield'),
('TELEFONIA', 'Telefonía', 'Troncales SIP, VoIP, codecs, conmutación y servidores de voz', '#0D9488', 'phone'),
('REDES_WAN', 'Redes WAN', 'BGP, tránsito IP, enlaces troncales, PortChannels e interconexiones', '#4F46E5', 'globe'),
('GRANDES_CLIENTES', 'Grandes Clientes', 'Cuentas corporativas, SLAs VIP, fibra dedicada e IP dedicada', '#7C3AED', 'building-2');

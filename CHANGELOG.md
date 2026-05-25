# Change Log

All notable changes to the "opencode-sidebar-web" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.7.1] - 2026-05-24

### Fixed
- Fix extension activation before checking commands in test
- Various bug fixes

## [0.7.0] - 2026-05-24

### Added
- Comando para instalar OpenCode desde VS Code

### Fixed
- Fix release workflow

## [0.6.0] - 2026-05-20

### Added
- Tests automatizados para detección remota y servidor existente
- CI/CD: ejecución de tests en workflows
- CI/CD: instalación de opencode-ai antes de tests
- Acción de deploy automatizada

## [0.5.0] - 2026-05-18

### Added
- CSP dinámico y URL de webview para soporte de devcontainer
- Configuración de devcontainer para desarrollo
- Auto-conexión a servidor existente en remoto
- Mejora en UI de instalación con logs en vivo

## [0.4.0] - 2026-05-15

### Added
- Detección automática de entorno remoto
- Conexión a servidor existente en remoto
- Instalación con streaming de logs vía `asExternalUri` proxy
- Configuración `devcontainerMode`

### Changed
- Forzar remote extension host

## [0.3.0] - 2026-05-10

### Changed
- Migración de panel a webview view en secondary sidebar

## [0.2.0] - 2026-05-01

### Added
- Sistema de deploy automatizado
- Acción de GitHub para release

### Changed
- Actualización del sistema de deploy y optimización de peso

## [0.1.0] - 2026-04-01

### Added
- Proyecto inicial con panel lateral
- Sistema de autostart
- Licencia MIT
- README con instrucciones básicas

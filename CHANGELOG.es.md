# Registro de Cambios

[🇬🇧 English](CHANGELOG.md)

Todos los cambios notables en la extensión "opencode-sidebar-web" se documentarán en este archivo.

Consulta [Keep a Changelog](http://keepachangelog.com/) para recomendaciones sobre cómo estructurar este archivo.

## [Unreleased]

### Añadido

- Phase 1 - implement OpenCodeAPI HTTP client
- Phase 2 - implement CodeLens and 4 inline code action commands
- Phase 3 - implement Send to Chat feature
- Phase 4 - implement Auto-link Active File feature
- Phase 6 - implement editor integration tests
- Add PlatformManager interface and factory (Phase 10 Task 1)
- Extract LinuxPlatformManager to separate file (Phase 10 Task 2)
- Extract MacOSPlatformManager to separate file (Phase 10 Task 3)
- Create GitHubAPI for release lookup, asset download, and streaming progress (Phase 10 Task 5)
- Extract WindowsPlatformManager to separate file (Phase 10 Task 4)
- Add opencodeVersion setting for selecting opencode binary version (Phase 10 Task 6)
- Rewrite OpenCodeServer.start() to download binary via PlatformManager + GitHubAPI (Phase 10 Task 7)
- Remove legacy binary management from OpenCodeServer.ts (Phase 10 Task 8)
- Remove legacy devcontainer settings and installBinary command (Phase 10 Task 9)
- Remove opencode-ai dependency, add adm-zip and modern-tar (Phase 10 Task 10)

### Cambiado

- Update IMPLEMENTATION_PLAN.md for Phase 2 completion
- Update IMPLEMENTATION_PLAN.md for Phase 3 completion
- Update IMPLEMENTATION_PLAN.md for Phase 4 completion
- Update IMPLEMENTATION_PLAN.md for Phase 6 completion
- Update README with editor integration features
- Update IMPLEMENTATION_PLAN.md for Phase 7 and Phase 8 completion
- Update IMPLEMENTATION_PLAN.md marking Phase 9.2, 9.6 complete
- Complete API discovery (Phase 9.1) — verify all endpoints against live opencode serve
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 2 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 3 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 5 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 4 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 6 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 7 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 8 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 9 completion
- Update IMPLEMENTATION_PLAN.md for Phase 10 Task 10 completion

### Corregido

- Use bundled opencode binary and active workspace
- Add content-type validation and remove broken context API calls (Phase 9.3-9.5)
- Add session lifecycle and correct API endpoint for complete() (Phase 9.2, 9.6)

## [0.7.1] - 2026-05-24

### Corregido
- Corregida la activación de la extensión antes de verificar comandos en tests
- Varias correcciones de errores

## [0.7.0] - 2026-05-24

### Añadido
- Comando para instalar OpenCode desde VS Code

### Corregido
- Corregido el workflow de release

## [0.6.0] - 2026-05-20

### Añadido
- Tests automatizados para detección remota y servidor existente
- CI/CD: ejecución de tests en workflows
- CI/CD: instalación de opencode-ai antes de tests
- Acción de deploy automatizada

## [0.5.0] - 2026-05-18

### Añadido
- CSP dinámico y URL de webview para soporte de devcontainer
- Configuración de devcontainer para desarrollo
- Auto-conexión a servidor existente en remoto
- Mejora en UI de instalación con logs en vivo

## [0.4.0] - 2026-05-15

### Añadido
- Detección automática de entorno remoto
- Conexión a servidor existente en remoto
- Instalación con streaming de logs vía `asExternalUri` proxy
- Configuración `devcontainerMode`

### Cambiado
- Forzar remote extension host

## [0.3.0] - 2026-05-10

### Cambiado
- Migración de panel a webview view en secondary sidebar

## [0.2.0] - 2026-05-01

### Añadido
- Sistema de deploy automatizado
- Acción de GitHub para release

### Cambiado
- Actualización del sistema de deploy y optimización de peso

## [0.1.0] - 2026-04-01

### Añadido
- Proyecto inicial con panel lateral
- Sistema de autostart
- Licencia MIT
- README con instrucciones básicas

# Registro de Cambios

[🇬🇧 English](CHANGELOG.md)

Todos los cambios notables en la extensión "opencode-sidebar-web" se documentarán en este archivo.

Consulta [Keep a Changelog](http://keepachangelog.com/) para recomendaciones sobre cómo estructurar este archivo.

## [Unreleased]

### Añadido

- Add changelog automation with git-cliff (EN/ES)
- Install changelog-generator skill
- Auto-create git tag and trigger release on new changelog version

### Cambiado

- Update README with editor integration features
- Add bilingual changelog with language toggle
- Add .storage/ to .gitignore
- Extract Python scripts from workflow to fix YAML heredoc issues
- Regenerate Unreleased section without Phase/Ralph entries

### Corregido

- Use bundled opencode binary and active workspace
- Filter Phase and Ralph commits from changelog

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

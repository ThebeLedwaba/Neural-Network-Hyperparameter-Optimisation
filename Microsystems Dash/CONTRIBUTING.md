# Contributing

We welcome contributions to the Greenhouse Monitoring & Control System! 

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Microsystems-Dash.git`
3. Create a branch for your feature: `git checkout -b feature/your-feature-name`
4. Follow the setup instructions in [INSTALL.md](INSTALL.md)

## Development Guidelines

## Code Quality
- Run linter before committing: `cd greenhouse-dashboard && npm run lint`
- Use consistent formatting (2 spaces for JavaScript, 2 spaces for C++)
- Write meaningful variable/function names
- Add comments for complex logic

### Testing
- Test changes locally before submitting PRs
- Test on actual ESP32 hardware for firmware changes
- Verify MQTT connectivity and data flow
- Test hardware controls (buzzer, LEDs, LCD)
- Check offline scenarios (WiFi disconnection)

### Commit Messages
- Use clear, descriptive messages
- Reference issues when applicable: `Fixes #123`
- Examples:
  - `feat: Add temperature alert notifications`
  - `fix: Resolve MQTT reconnection issue`
  - `docs: Update installation guide`
  - `refactor: Simplify chart rendering logic`

## Pull Request Process

1. Update documentation if needed
2. Test your changes thoroughly
3. Push to your fork
4. Create a Pull Request with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots for UI changes
5. Address review comments

## Reporting Bugs

Create an issue with:
- Clear title and description
- Steps to reproduce
- Expected vs. actual behavior
- System information (OS, Node version, etc.)
- Relevant logs or screenshots

## Feature Requests

Describe:
- Problem being solved
- Proposed solution
- Use cases or examples
- Acceptance criteria

## Questions?

- Check existing issues and discussions
- Review [README.md](README.md) and [INSTALL.md](INSTALL.md)
- Create a discussion for questions

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

Thank you for contributing! 🌱

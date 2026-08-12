# mf-macos WidgetKit + menu bar visuals (1.0.12)

Screenshots are **not** stored in git. They are uploaded via the GitHub Releases API and linked below.

**Release:** [https://github.com/masterfabric/masterfabric-project-tracker/releases/tag/mf-macos-1.0.12-screenshots](https://github.com/masterfabric/masterfabric-project-tracker/releases/tag/mf-macos-1.0.12-screenshots)

## Desktop widgets

| Widget | Size | Preview |
|--------|------|---------|
| Dashboard | Medium | ![Dashboard Medium](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/widget-01-dashboard-medium.png) |
| Dashboard | Large | ![Dashboard Large](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/widget-02-dashboard-large.png) |
| Focus Timer | Small | ![Focus Small](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/widget-03-focus-small.png) |
| Quick Add | Small | ![Quick Add Small](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/widget-04-quick-add-small.png) |
| Quick Add | Medium | ![Quick Add Medium](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/widget-05-quick-add-medium.png) |
| Open Tasks | Medium | ![Tasks Medium](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/widget-06-tasks-medium.png) |

## Menu bar / deep-link flows

| Step | Preview |
|------|---------|
| Closed menu bar strip | ![Menubar](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-00-menubar-strip.png) |
| Login / auth gate | ![Login](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-01-login.png) |
| Tasks (Today/Week/All + New) | ![Tasks](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-02-tasks.png) |
| Chat | ![Chat](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-03-chat.png) |
| Projects | ![Projects](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-04-projects.png) |
| Timer | ![Timer](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-05-timer.png) |
| Desktop Dashboard | ![Dashboard](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-06-dashboard.png) |
| Compose | ![Compose](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/flow-07-compose.png) |

## Desktop overview

![Desktop overview](https://github.com/masterfabric/masterfabric-project-tracker/releases/download/mf-macos-1.0.12-screenshots/00-desktop-overview.png)

## Re-upload (maintainers)

From a machine with the PNGs on disk:

```bash
gh release upload mf-macos-1.0.12-screenshots ./widget-*.png ./flow-*.png ./00-desktop-overview.png --clobber
```

Or recreate:

```bash
gh release create mf-macos-1.0.12-screenshots \
  --title "mf-macos 1.0.12 — widget & flow screenshots" \
  --notes "API-hosted screenshots for docs/PR" \
  ./assets/*.png
```

# Khondamir Begmatov — личный сайт

Сайт на **Astro**: главная с видео-хиро, блог и страница «Обо мне».
Язык — английский. Публикуется на GitHub Pages автоматически.

Адрес: **https://moremaekjupls.github.io**

---

## 1. Как добавить пост

Проще всего — через браузер: **https://app.pagescms.org**, вход через GitHub,
выбираете этот репозиторий. Конфиг `.pages.yml` уже лежит в корне.
Сохранение = коммит = сайт пересобирается.

Если правите файлами: посты лежат в `src/content/blog/`, файл `имя.en.md`. Шапка:

```yaml
---
title: "Title"
excerpt: "One or two lines for the blog list."
pubDate: 2026-08-10          # YYYY-MM-DD
lang: "en"
transId: "my-post"           # он же адрес /blog/my-post
---
```

Черновик прячется строкой `draft: true` в шапке.

---

## 2. Где что менять

| Что | Файл |
|---|---|
| Ссылки на соцсети, домен, почта, форма, аналитика | `src/consts.ts` |
| Тексты навигации, блога, подвала, формы | `src/i18n/ui.ts` |
| Страница «Обо мне» | `src/components/views/AboutView.astro` |
| Главная: заголовок, карточки, видео | `src/components/Hero.astro` |
| Цвета, типографика, отступы | `src/styles/global.css` (блок `:root`) |

---

## 3. Структура

```
src/
  layouts/
    Screen.astro          ← каркас главной: один экран, без шапки и подвала
    Base.astro            ← каркас внутренних страниц: шапка, подвал, прокрутка
  components/
    Hero.astro            ← главная: видео, меню, последний пост
    Header.astro, Footer.astro
    ContactForm.astro     ← форма связи (см. п. 5)
    Analytics.astro       ← счётчик (см. п. 5)
    views/                ← содержимое страниц About, Blog, пост
  pages/                  ← маршруты, плюс 404, rss.xml, sitemap.xml
  content/blog/           ← посты
  i18n/ui.ts              ← тексты интерфейса
  styles/global.css       ← токены и стили
public/
  hero.mp4, hero-frame.jpg ← видео главной и его постер
  404.mp4                 ← видео страницы 404
  fonts/                  ← Geist и Silkscreen, локально
  og.jpg                  ← превью для соцсетей, 1200×630
```

---

## 4. Запуск и публикация

Нужен Node.js 18+ и pnpm.

```bash
pnpm install      # один раз
pnpm dev          # локальный просмотр, http://localhost:4321
pnpm build        # сборка в dist/
```

Любой push в `main` запускает `.github/workflows/deploy.yml`: сборка и публикация
на GitHub Pages. Ход — вкладка **Actions**.

Настройка Pages: **Settings → Pages → Source: GitHub Actions**.

---

## 5. Что выключено и как включить

**Форма обратной связи.** Пока `CONTACT.formspreeEndpoint` в `src/consts.ts` пуст,
форма на «Обо мне» скрыта. Включить: создать форму на formspree.io и вставить её endpoint.

**Аналитика.** Блок `ANALYTICS` в `src/consts.ts`: `enabled: true`, `provider`
(`plausible` или `goatcounter`) и `site`. Без кук и без баннера согласия.

---

## 6. Если деплой упал

Открыть **Actions**, найти красный запуск, посмотреть, какой job упал.

- Упал **build** — ошибка в коде, лог покажет файл и строку.
- Упал **deploy** с `Timeout reached` — GitHub Pages не ответил вовремя. Это не
  ошибка проекта. Нажмите **Re-run jobs**. Лимит ожидания в workflow уже поднят
  до 30 минут.

Откатить неудачное изменение: вкладка **Commits**, нужный коммит, кнопка **Revert**.

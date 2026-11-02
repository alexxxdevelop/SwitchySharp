# Chrome Web Store listing

Texts for the Chrome Web Store Developer Dashboard. The English version is the main one; the Russian
one can be added as a localized listing.

Before uploading, **remove the `"key"` field from `manifest.json`** (the store rejects packages
with it) and zip the extension folder without `README.md`, `STORE_LISTING.md` and `.gitignore`.

---

## English

**Name:** Proxy SwitchySharp

**Category:** Tools

**Short description** (from `manifest.json`, max 132 characters):

> Fast proxy switcher: proxy profiles, URL-based auto switch rules, online rule lists. Manifest V3, dark and light themes.

**Detailed description:**

```
SwitchySharp is a fast and simple proxy switcher. Create proxy profiles and switch between them
in one click, or let the extension choose a proxy for every site automatically.

This is a reworked version of the classic Proxy SwitchySharp. The original extension was abandoned
years ago and can no longer be installed in modern browsers. This version is rebuilt for
Manifest V3 and has a new design with dark and light themes.

FEATURES
• Proxy profiles: HTTP, HTTPS, FTP, SOCKS4 and SOCKS5 proxies, bypass list, PAC scripts
  (by URL or from a file).
• Auto Switch Mode: a proxy for every site by your rules (wildcard or regular expressions).
  The toolbar icon shows the profile used by the current page.
• Online Rule List: download a rule list (SwitchySharp or AutoProxy / gfwlist format) and keep it
  updated automatically.
• Quick Switch: cycle through your favourite profiles with one click on the icon.
• Startup profile applied when the browser starts.
• Export your rules as a PAC file or a rule list, back up and restore all options.
• Dark theme by default, light theme in one click.
• English, Russian and Simplified Chinese interface.
• Options from the old SwitchySharp and its backup files are supported.

PRIVACY
SwitchySharp does not collect, store or send any personal data. The extension makes network
requests only to the addresses you enter yourself (PAC scripts, rule lists, backups).

Open source, licensed under GPL v3.
```

---

## Русский

**Название:** Proxy SwitchySharp

**Краткое описание** (до 132 символов):

> Быстрое переключение прокси: профили, автоматический выбор прокси по правилам, онлайн-списки. Manifest V3, тёмная и светлая темы.

**Подробное описание:**

```
SwitchySharp — быстрый и простой переключатель прокси. Создайте профили прокси и переключайтесь
между ними в один клик или позвольте расширению самому выбирать прокси для каждого сайта.

Это доработанная версия классического Proxy SwitchySharp. Оригинальное расширение давно заброшено
и не устанавливается в современные браузеры. Эта версия переписана под Manifest V3 и получила
новый дизайн с тёмной и светлой темами.

ВОЗМОЖНОСТИ
• Профили прокси: HTTP, HTTPS, FTP, SOCKS4 и SOCKS5, список исключений, PAC-скрипты
  (по ссылке или из файла).
• Режим авто-переключения: прокси для каждого сайта по вашим правилам (шаблоны или регулярные
  выражения). Иконка на панели показывает, какой профиль использует текущая страница.
• Онлайн-список правил: загрузка списка (формат SwitchySharp или AutoProxy / gfwlist)
  с автоматическим обновлением.
• Быстрое переключение: перебор избранных профилей одним кликом по иконке.
• Профиль, применяемый при запуске браузера.
• Экспорт правил в PAC-файл или список правил, резервное копирование и восстановление настроек.
• Тёмная тема по умолчанию, светлая — в один клик.
• Интерфейс на русском, английском и китайском.
• Поддерживаются настройки и файлы резервных копий старого SwitchySharp.

КОНФИДЕНЦИАЛЬНОСТЬ
SwitchySharp не собирает, не хранит и не передаёт персональные данные. Расширение обращается
к сети только по адресам, которые вы указали сами (PAC-скрипты, списки правил, резервные копии).

Открытый исходный код, лицензия GPL v3.
```

---

## Privacy practices tab

**Single purpose:**

> Manage browser proxy settings: switch between user-defined proxy profiles manually or automatically by URL rules.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `proxy` | Applies the proxy profile or the PAC script generated from the user's rules. This is the core function of the extension. |
| `tabs` | Reads the URL of the active tab to show which proxy profile Auto Switch Mode uses for it (toolbar icon and title), and reloads the active tab after switching when the user enables this option. |
| `storage` | Stores the user's proxy profiles, switch rules and options locally. |
| `alarms` | Periodically updates the online rule list at the interval chosen by the user. |
| Host permission `<all_urls>` | Downloads PAC scripts, rule lists and backup files from arbitrary URLs entered by the user. |

**Remote code:** No. The extension does not load or execute remote code. Downloaded PAC scripts
are passed to the browser's proxy settings as data and are never executed by the extension.

**Data usage:** the extension does not collect any user data (check none of the data types).
Certify that data is not sold, not used for unrelated purposes and not used for creditworthiness.

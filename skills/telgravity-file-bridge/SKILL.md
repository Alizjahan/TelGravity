---
name: telgravity-file-bridge
description: >-
  Manages bidirectional file exchange and structured archiving between Telegram and Antigravity via TelGravity.
  ACTIVATION RULE: Activates ONLY during Telegram remote sessions (when prompts contain TelGravity tags or Telegram context).
  Automatically routes user-received files and generated deliverables (PDFs, images, charts, documents, code exports)
  into the structured 'Archie file Send&Receive/' hierarchy and tags them for instant Telegram delivery.
  Does NOT activate or interfere when the user works locally/directly in Antigravity on their computer.
---

# TelGravity File Bridge & Archiving System (پل تبادل و بایگانی فایل تل‌گرویتی)

این مهارت (Skill) ساختار اختصاصی و استاندارد تبادل، دسته‌بندی و ارسال دوطرفه فایل‌ها میان کاربر در تلگرام و سیستم هوش مصنوعی Antigravity را مدیریت می‌کند.

> [!IMPORTANT]
> **شرط فعال‌سازی مهارت (Activation Boundary):**
> این مهارت **تنها و تنها زمانی فعال است** که تعامل کاربر از طریق **ربات تلگرام TelGravity** صورت گرفته باشد (وجود برچسب‌های `[TelGravity Telegram Remote Session]` یا پیام‌های ارسالی از تلگرام).
> در استفاده عادی و محلی که کاربر مستقیماً پشت سیستم نشسته و با نرم‌افزار Antigravity گفتگو می‌کند، این مهارت غیرفعال بوده و فایل‌ها در ساختار عادی پروژه مدیریت می‌شوند.

---

## 📂 درخت استاندارد فایل‌ها (Directory Structure)

تمام فایل‌های تبادل‌شده در طول اتصال ریموت تلگرام درون ریشه پروژه در پوشه `Archie file Send&Receive/` طبق ساختار زیر ساماندهی می‌شوند:

```
Archie file Send&Receive/
├── Receive/               # فایل‌های ارسال‌شده از شما در تلگرام به ربات
│   ├── Images/            # عکس‌ها، اسکرین‌شات‌ها و تصاویر ارسالی
│   ├── Voices/            # ویس‌ها و پیام‌های صوتی ضبط‌شده شما
│   ├── PDF/               # کتاب‌ها، مقالات و فایل‌های پی‌دی‌اف
│   └── Documents/         # فایل‌های کد، اسناد متنی و ضمیمه‌ها
└── Send/                  # فایل‌های ارسال‌شده از ربات به تلگرام
    ├── Screenshots/       # اسکرین‌شات‌های زنده و مستقیم از صفحه
    ├── Images/            # تصاویر و چارت‌های تولیدشده توسط سیستم
    ├── PDF/               # گزارش‌ها و مستندات خروجی پی‌دی‌اف
    └── Documents/         # کدهای نهایی، لاگ‌ها و فایل‌های تحویلی
```

---

## 📥 ۱. رفتار سیستم در قبال فایل‌های دریافتی (Receive)

هنگامی که کاربر در تلگرام عکس، ویس، پی‌دی‌اف یا هر سندی ارسال می‌کند:
- ربات تل‌گرویتی به صورت خودکار فایل را دانلود کرده و در مسیر دقیق زیرشاخه `Receive/` ذخیره می‌کند.
- پرامپت ارسالی به هوش مصنوعی مسیر مطلق فایل محلی را همراه با نام و توضیحات کاربر ارائه می‌دهد.
- مدل باید فایل محلی را با ابزارهای خواندن (`read_file`, `run_command` و ...) بازبینی و پردازش کند.

---

## 📤 ۲. رفتار سیستم در قبال خروجی‌ها و فایل‌های تحویلی (Send)

هنگامی که در حین گفتگوی ریموت تلگرام، کاربر از سیستم درخواست یک خروجی فایلی می‌کند (مانند گزارش تحلیلی، فایل PDF، نمودار آماری، قطعه کد، اسکریپت خروجی، فایل فشرده، یا لاگ):

1. **محل ذخیره‌سازی خروجی:**
   هوش مصنوعی **باید** فایل تولیدشده را در یکی از پوشه‌های مربوطه در مسیر `Archie file Send&Receive/Send/` ایجاد کند:
   - گزارش‌ها و اسناد PDF: `Archie file Send&Receive/Send/PDF/<FileName>.pdf`
   - نمودارها و تصاویر تولیدشده: `Archie file Send&Receive/Send/Images/<FileName>.png`
   - فایل‌های کد، متن، اسناد، آرشیوها و خروجی‌های داده: `Archie file Send&Receive/Send/Documents/<FileName>.<ext>`

2. **برچسب ارسال مستقیم به تلگرام (Delivery Tag):**
   هوش مصنوعی در متن پاسخ نهایی خود **باید** از برچسب زیر استفاده کند تا سیستم تل‌گرویتی بلافاصله آن را به چت تلگرام کاربر فوروارد نماید:
   ```
   [SEND_FILE: <path_to_file>]
   ```
   *مثال:*
   `[SEND_FILE: Archie file Send&Receive/Send/PDF/Project_Audit_Report.pdf]`
   یا
   `[SEND_FILE: D:/UNI-c/MyProject/5-  Anti_Telegram/Archie file Send&Receive/Send/Documents/solution.py]`

3. ربات TelGravity به صورت هوشمند این تگ را تشخیص داده، تگ را از متن نمایش عمومی حذف کرده و فایل فیزیکی را به صورت یک سند تلگرامی یا تصویر مستقیم همراه با کپشن تمیز برای کاربر ارسال می‌کند.

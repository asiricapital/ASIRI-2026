# Architecture — Asiri Intelligence Core v0.1

## المبادئ

1. النواة مستقلة عن تطبيقات Music وCapital وAGIP.
2. كل مشروع يرسل أحداثًا وقرارات وذكريات عبر API موحد.
3. قاعدة البيانات هي مصدر الحقيقة، وليس ذاكرة المتصفح أو المحادثات.
4. الذكاء الاصطناعي طبقة فوق البيانات، وليس بديلًا عنها.
5. العزل والصلاحيات يطبقان من قاعدة البيانات باستخدام RLS.

## المكونات

```text
Clients
  ├─ Asiri Music OS
  ├─ Asiri Capital
  ├─ AGIP
  └─ Core Dashboard
          │
          ▼
FastAPI Core Service
  ├─ Projects
  ├─ Tasks
  ├─ Decisions
  ├─ Memories
  ├─ Activity Events
  └─ Universal Search
          │
          ▼
Supabase PostgreSQL
  ├─ Auth
  ├─ Row Level Security
  ├─ Full Text Search
  └─ pgvector
```

## حدود الإصدار v0.1

### داخل النطاق

- هوية المستخدم.
- المشاريع.
- المهام.
- القرارات مع المبررات.
- الذاكرة المنظمة.
- سجل النشاط.
- بحث نصي موحد.
- واجهة Dashboard أولية.

### خارج النطاق مؤقتًا

- التداول الآلي.
- تحليل المنافسات الكامل.
- الوكلاء الذاتيون.
- إرسال التنبيهات.
- مزامنة Gmail وDrive.
- البحث الدلالي الفعلي قبل اختيار مزود embeddings.

## نموذج التكامل

كل تطبيق خارجي يرسل أحداثًا بالشكل التالي:

```json
{
  "project_slug": "asiri-music-os",
  "event_type": "decision.created",
  "entity_type": "decision",
  "payload": {
    "title": "إيقاف تشغيل Spotify داخل Safari",
    "rationale": "Web Playback SDK غير مستقر على iOS"
  }
}
```

## قرارات معمارية أولية

- ADR-001: PostgreSQL/Supabase هو مصدر الحقيقة.
- ADR-002: FastAPI هو بوابة الخدمات والتكاملات.
- ADR-003: Next.js هو واجهة الإدارة الأساسية.
- ADR-004: كل ذاكرة يجب أن تحمل نوعًا ومصدرًا ودرجة أهمية.
- ADR-005: القرارات تحفظ مع السياق والمبرر والبدائل، وليس النتيجة فقط.

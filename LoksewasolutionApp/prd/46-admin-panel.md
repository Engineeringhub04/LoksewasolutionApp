# 46. Admin Panel Requirements

Separate web-based admin interface (not part of the mobile app).

## 46.1 Content Management
- Subjects/Chapters/Topics — full CRUD, rich text/image notes
- Question Bank CRUD — MCQ/subjective, subject/chapter/difficulty tags, correct answer + explanation
- Mock Tests / Live Exams — definitions (question sets, duration, marking, scheduled start for Live), publish/unpublish
- Current Affairs CRUD (dated, categorized)
- Daily Gorkhapatra CRUD (dated)
- Notices CRUD (featured-on-Home flag)
- PDF/document upload & management

## 46.2 User & Community Management
- View/search users, suspend/ban
- Moderate posts/comments, view reports, remove violations
- View/manage Report-a-Problem tickets with resolution status

## 46.3 App Configuration Management
- Edit all remote-configurable fields (05-app-config.md): Maintenance Mode + message, Force Update versions, Feature Toggles, Ad Unit IDs, branding colors, social/contact links
- Propagates on next app config check without store update

## 46.4 Analytics Dashboard
- DAU/MAU, retention, mock test completion, engagement (Section 2.3)

## 46.5 Notification Management
- Compose & send push to all/segments (by exam category, activity), with deep-link targets (49-notifications.md)

## 46.6 Access Control
- Role-based: Super Admin / Content Editor / Moderator

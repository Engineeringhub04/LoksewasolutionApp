/**
 * Loksewa Solution — Theory Answer Upload notifier.
 *
 * DEPLOYMENT STEPS:
 * 1. Go to https://script.google.com → New project.
 * 2. Delete the default content and paste this whole file in.
 * 3. Replace DISCORD_WEBHOOK_URL below with your Discord channel's webhook URL
 *    (Discord: Channel Settings → Integrations → Webhooks → New Webhook → Copy
 *    Webhook URL).
 * 4. Deploy → New deployment → type: "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the deployment's Web app URL (ends in /exec).
 * 6. Paste that URL into src/core/config/appConfig.ts:
 *      messaging.examAnswerWebhook.appsScriptUrl
 *
 * Any time you edit this script after the first deploy, use
 * Deploy → Manage deployments → Edit → New version, otherwise the live /exec
 * URL keeps serving the old code.
 */

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1536947550207221810/eZzrEEB1zfSheqd2O9yB9rfiETUpdNdHbYS-WPQVuEGQS0QNh8HGmJZcXpocJZ4_KWCB';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.type === 'exam_answer_submitted') {
      postExamAnswerEmbed(body);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function postExamAnswerEmbed(body) {
  const embed = {
    title: '📝 New Theory Answer Submitted',
    color: 0x2563EB,
    fields: [
      { name: 'Student', value: body.studentName || 'Unknown', inline: true },
      { name: 'Course', value: [body.courseName, body.subcourseName].filter(Boolean).join(' · ') || '—', inline: true },
      { name: 'Paper', value: body.examSetTitle || '—', inline: false },
      { name: 'Message', value: body.message || '(no message)', inline: false },
      { name: 'Answer PDF', value: body.pdfUrl || '—', inline: false },
    ],
    timestamp: new Date().toISOString(),
  };

  UrlFetchApp.fetch(DISCORD_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ embeds: [embed] }),
    muteHttpExceptions: true,
  });
}
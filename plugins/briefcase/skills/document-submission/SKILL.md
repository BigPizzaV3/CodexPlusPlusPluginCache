---
name: document-submission
description: Submit a bill, receipt, bank statement or supplier statement to a Briefcase client, choosing between direct upload, a browser upload link and the client's forwarding email, then track processing to the resulting transaction. Use when the user shares a document or asks to upload, send or file something into Briefcase.
---

# Submitting documents to Briefcase

## Choose the client

Resolve the client with `briefcase_list_clients` and confirm it with the user when the name is ambiguous. Ask for a business or property only when the client has more than one (`briefcase_get_reference_data` with `kind: businesses` or `properties`).

## Prepare the upload

Call `briefcase_create_document_upload` with the file name, MIME type, size if known, and the user's note (for example "Pay from the deposit account" or "Split 60/40 with the Manchester office").

When the user attached the file in the conversation and your host passes attachments to tools (ChatGPT does), pass it as `file`. Briefcase downloads it itself and `next_step` says the file is already in Briefcase: go straight to `briefcase_submit_document` with the `upload_id` and a fresh `idempotency_key`.

Otherwise the response gives three routes:

1. **You can transfer the file.** `PUT` the original bytes to `upload_url` with the returned headers, then call `briefcase_submit_document` with the `upload_id` and a fresh `idempotency_key`.
2. **You cannot transfer the file.** Give the user `browser_upload_url`. They open it, sign in, check the client and note, choose the file and press Upload. The link expires after one hour and only accepts the prepared file type.
3. **Email.** Give the user `forwarding_email` and tell them to put the note in the email body.

Never fabricate file contents and never submit a file the user did not provide.

## Track processing

`briefcase_submit_document` returns an operation. Poll `briefcase_get_operation` no more than once every few seconds until it reaches a final state, then report:

- the transaction, bank statement or supplier statement that was created, with its status;
- an archive as duplicate or not-a-transaction, with the reason. A created transaction marked `archived: true` was archived by duplicate detection; `briefcase_get_transaction` shows status `ARCHIVED` and a `POSSIBLE_DUPLICATE` warning naming the original;
- a failure, with the message, and suggest re-uploading a clearer copy.

On Autopilot clients a submitted document may publish automatically. Say so before submitting when `briefcase_get_client` shows Autopilot is on.

## Retries and refusals

Retry a failed `briefcase_submit_document` with the same `idempotency_key`; Briefcase will not create a second candidate. A `FORBIDDEN` result means the user cannot upload for this client or assistant changes are paused. `VALIDATION_ERROR` on file type or size means the document must go through the app or email instead.

# Security Specification & "Dirty Dozen" Hardening

## 1. Data Invariants
- **Identity Invariant**: Users can only create or update their own user profile document where `request.auth.uid == userId`.
- **Relational Conversation Invariant**: A user can only access or read messages in a conversation if they are listed in `conversation.participants`.
- **Message Integrity**: Messages can only be created by an authenticated user whose `request.auth.uid == incoming().senderId`.
- **Immutability of Key Identifiers**: Fields such as `id`, `senderId`, `conversationId`, `createdAt` cannot be altered after creation.
- **Friend Request Integrity**: Only the sender can initiate a request (`request.auth.uid == incoming().fromUserId`), and only the recipient (`toUserId`) can accept or reject it.
- **Story Ownership**: Only the author can post or delete their stories.
- **Poll Invariant**: Only participants of the parent conversation can view or vote in a poll.

## 2. The "Dirty Dozen" Malicious Payloads

1. **Payload 1 - User Profile Impersonation**: Attacker attempts to create a profile under another user's UID (`auth.uid != userId`).
2. **Payload 2 - Identity Elevation via Privilege Escalation**: User attempts to assign themselves an admin flag or alter another user's profile.
3. **Payload 3 - Conversation Hijack**: Non-participant writes a message to a private conversation.
4. **Payload 4 - Sender Spoofing**: User sends a message with `senderId` set to a victim user's ID.
5. **Payload 5 - Message Timestamp Forgery**: Attacker injects a fake past or future timestamp into `createdAt`.
6. **Payload 6 - Malicious Huge Payload (Denial of Wallet)**: Attacker sends a 500KB text payload to exceed length limits.
7. **Payload 7 - Story Deletion by Non-Owner**: Attacker attempts to delete another user's story document.
8. **Payload 8 - Friend Request Recipient Manipulation**: Attacker tries to accept a friend request intended for another user (`auth.uid != toUserId`).
9. **Payload 9 - Poll Vote Tampering**: Attacker attempts to overwrite all poll results with arbitrary voter data.
10. **Payload 10 - Shadow Update Ghost Field**: Attacker sends legitimate message updates combined with an unauthorized `verified: true` shadow key.
11. **Payload 11 - Call Log Spoofing**: Attacker injects fake call logs between two unrelated users.
12. **Payload 12 - ID Poisoning with Special Characters**: Attacker attempts to create a document with a 2KB junk string as document ID.

## 3. Test Runner Invariant
All of the above payloads must strictly yield `PERMISSION_DENIED` under `firestore.rules`.

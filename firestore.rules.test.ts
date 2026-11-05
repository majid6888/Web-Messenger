/**
 * Firestore Security Rules Test Suite
 * Validates Dirty Dozen payloads return PERMISSION_DENIED
 */

export interface TestCase {
  name: string;
  operation: 'create' | 'update' | 'delete' | 'read';
  path: string;
  authUid?: string;
  data?: Record<string, any>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const dirtyDozenTestCases: TestCase[] = [
  {
    name: 'Dirty 1: User Profile Impersonation',
    operation: 'create',
    path: 'users/victim_user_123',
    authUid: 'attacker_user_456',
    data: { id: 'victim_user_123', displayName: 'Hacker', createdAt: Date.now() },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 2: Altering another user profile',
    operation: 'update',
    path: 'users/victim_user_123',
    authUid: 'attacker_user_456',
    data: { displayName: 'Defaced Name' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 3: Non-participant writing to conversation',
    operation: 'create',
    path: 'conversations/conv_1/messages/msg_999',
    authUid: 'intruder_user_789',
    data: {
      id: 'msg_999',
      conversationId: 'conv_1',
      senderId: 'intruder_user_789',
      senderName: 'Intruder',
      type: 'text',
      text: 'Spam',
      status: 'sent',
      createdAt: Date.now(),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 4: Sender Spoofing in Message',
    operation: 'create',
    path: 'conversations/conv_1/messages/msg_100',
    authUid: 'attacker_user',
    data: {
      id: 'msg_100',
      conversationId: 'conv_1',
      senderId: 'innocent_victim',
      senderName: 'Innocent Victim',
      type: 'text',
      text: 'Impersonated message',
      status: 'sent',
      createdAt: Date.now(),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 5: Attacker deleting another users story',
    operation: 'delete',
    path: 'stories/story_victim_1',
    authUid: 'attacker_user',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 6: Friend Request acceptance by non-recipient',
    operation: 'update',
    path: 'friendRequests/req_123',
    authUid: 'intruder_user',
    data: { status: 'accepted' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 7: Message size limit attack (Denial of Wallet)',
    operation: 'create',
    path: 'conversations/conv_1/messages/msg_huge',
    authUid: 'legit_user_1',
    data: {
      id: 'msg_huge',
      conversationId: 'conv_1',
      senderId: 'legit_user_1',
      senderName: 'User',
      type: 'text',
      text: 'a'.repeat(20000), // Exceeds maxLength of 5000
      status: 'sent',
      createdAt: Date.now(),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 8: Path ID Poisoning with special characters',
    operation: 'create',
    path: 'users/bad%20id$$!#',
    authUid: 'attacker',
    data: { id: 'bad%20id$$!#', displayName: 'Poison' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 9: Ghost field injection on message update',
    operation: 'update',
    path: 'conversations/conv_1/messages/msg_1',
    authUid: 'legit_user_1',
    data: { text: 'Valid update', isSuperAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 10: Story creation without authentication',
    operation: 'create',
    path: 'stories/story_anon',
    authUid: undefined,
    data: { id: 'story_anon', content: 'hello' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 11: Tampering with Call Logs of other users',
    operation: 'create',
    path: 'callLogs/call_spoofed',
    authUid: 'attacker',
    data: { id: 'call_spoofed', callerId: 'user_a', receiverId: 'user_b', type: 'voice', status: 'completed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: 'Dirty 12: Direct catch-all bypass attempt',
    operation: 'read',
    path: 'random_hidden_collection/secret',
    authUid: 'attacker',
    expectedResult: 'PERMISSION_DENIED',
  },
];

console.log(`Loaded ${dirtyDozenTestCases.length} security test cases.`);

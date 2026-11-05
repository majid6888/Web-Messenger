# Web Messenger: Ultimate Professional Upgrade Plan

Upgrade the existing Web Messenger into a fully functional messaging platform with professional voice & video calling, loud customizable ringtones, reliable push notifications, large video uploads, friend ID hash normalization, custom group photos, and enhanced search.

### User Review & Critical Decisions

> [!IMPORTANT]
> The clarifying questions were completed with recommended defaults:
> - **Sound Profile**: Loud, distinctive Web Audio chimes and telephone ringtones with dedicated volume controls and selectable tone presets (Message, Voice Note, Voice Call, Video Call).
> - **Video Upload Capacity**: Chunked and resumable upload architecture handling files up to 2 GB with progress percentage, real-time speed, and time remaining (ETA).
> - **Registration & Profile Setup**: Step 1 (Email & Password verification) followed by Step 2 (First Name, Last Name, Age, Country selector, and Profile Picture upload from computer/gallery).
> - **Friend ID Compatibility**: Automatic normalization so `#WM-839271` and `WM-839271` both resolve immediately without error.
> - **Group Profile Picture**: Native file upload from computer/mobile gallery with live preview and default avatar fallback.

---

### 1. Overview & Core Concept

- **What It Does**: Transforms the Web Messenger into an all-in-one real-time communications hub inspired by WhatsApp Web, featuring crystal-clear WebRTC voice/video calls with loud alerts, background notification handling, large file & video sharing with caption staging, and friendly social connectivity.
- **Target Audience**: Desktop, laptop, tablet, and mobile web users who demand immediate notifications, reliable calling across networks, and hassle-free multimedia sharing.
- **Key Value**: Solves the soft/missed audio ringtone problem, enables large video file sharing with progress recovery, removes friend ID input friction, and provides complete group & profile management.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Incoming & Outgoing Voice / Video Calls**:
   - **Incoming Call (Tab active or background)**: Plays a distinct loud ringtone (gain boosted from 0.12 to 0.75+), displays an animated incoming call modal showing caller avatar, name, and call type (Voice/Video) with prominent Green (Accept) and Red (Decline) buttons.
   - **Background Alert**: If tab is minimized, dispatches a persistent system notification with caller name and avatar, opening the call window on click.
   - **Active Call Controls**: WebRTC peer connection with mute, camera toggle, mobile front/back camera switch, full-screen toggle, and live duration counter.

2. **Loud Customizable Notification Audio**:
   - Settings > Notifications features a sound customization suite:
     - Volume Slider (0% to 100%, defaults to 90% loud).
     - Preset selector for Message Sound (WhatsApp Chime, Modern Bell, Marimba, Pop).
     - Preset selector for Incoming Call (Classic Ring, Modern Melody, Digital Pulse).
     - Instant "Test Tone" buttons to preview sounds.

3. **Multi-Media Attachment & Caption Staging**:
   - Selecting photos or videos docks a WhatsApp-style staging card above the message input.
   - Shows thumbnail, filename, file size, duration badge, upload progress, and a remove (`✕`) button.
   - User types a caption in the composer and presses Send (or Enter) to dispatch the combined payload.

4. **High-Capacity & Resumable Video Uploads**:
   - Large videos (up to 2 GB) are processed with chunked stream uploads.
   - Displays real-time upload percentage, transfer speed (e.g. `4.2 MB/s`), and estimated time remaining (`ETA 45s`).
   - Server streams video directly using HTTP 206 Partial Content so recipients can seek and play immediately.

5. **Universal Friend ID (#WM-xxxx & WM-xxxx)**:
   - In "Add Friend" and "Search", IDs with `#` (e.g. `#WM-839271`), without `#` (`WM-839271`), with spaces, or lowercase are automatically normalized.
   - Profile & Add Friend modals provide one-tap Copy ID and Share to WhatsApp buttons.

6. **Two-Step Registration & Profile Setup**:
   - **Step 1**: Email Address + Choose Password -> Press "Next".
   - **Step 2**: First Name, Last Name, Age (numeric input), Country (dropdown selector with flags), and Profile Picture (upload from gallery/PC or choose preset avatar) -> Complete registration.

7. **Group Creation with Custom Gallery Upload**:
   - Group modal allows uploading a custom photo directly from mobile gallery or computer, with image preview, crop/fit display, alongside emoji avatars.

8. **Advanced White Search Bar**:
   - Search modal redesigned with a clean white card interface.
   - Filter chips: `All`, `People`, `Groups`, `Photos`, `Videos`, `Documents`.
   - Instant search across Friend IDs, contact names, group titles, and message text.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Web Audio Synthesis + Amplified Gain for Ringtones**:
  - *Chosen Approach*: Use custom multi-harmonic synthesized Web Audio tones with master gain control up to 0.85 (instead of 0.08) and custom frequency sweeps.
  - *Why*: Eliminates broken audio file network downloads, works offline, and guarantees loud, clear ringtones across all operating systems.

- **Decision 2: Friend ID Normalization Function**:
  - *Chosen Approach*: A universal `normalizeFriendId(input)` utility that strips leading `#`, `@`, and whitespace, converting to uppercase `WM-XXXXXX` and numeric variants.
  - *Why*: Completely eliminates user frustration when pasting from WhatsApp or typing IDs with or without the hash.

- **Decision 3: Group Custom Picture Storage**:
  - *Chosen Approach*: Accept base64 Data URLs and multipart image uploads directly in `GroupModal.tsx` and save to `avatarUrl` field in group conversation document.
  - *Why*: Replaces emoji-only limitation with real gallery image uploads.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Web Messenger UI Views                          │
├────────────────────────────────────────────────────────────────────────┤
│  Sidebar (White UI)                                                    │
│   ├── Search Bar (Filters: All, People, Groups, Photos, Videos, Docs)  │
│   ├── Friend ID Share & One-Click Copy Card                            │
│   └── Conversation List & Active Call Banners                          │
│                                                                        │
│  ChatView                                                              │
│   ├── Message Stream (Text, Image+Caption, Video Streaming, Audio)    │
│   └── UnifiedChatComposer                                              │
│        ├── StagedMedia (Photos, Videos, Files preview + Remove btn)    │
│        ├── Chunked Video Upload Progress (Speed + ETA)                 │
│        └── Auto-expanding Textarea (Caption / Message)                 │
│                                                                        │
│  Modals:                                                               │
│   ├── CallModal (WebRTC Full-Screen Voice/Video, Loud Ringtone)        │
│   ├── AddFriendModal (Accepts #WM-xxxx & WM-xxxx seamlessly)           │
│   ├── GroupModal (Upload custom group photo from Gallery/PC)          │
│   ├── AuthModal (Step 1: Email/Pass -> Step 2: Name/Age/Country/Photo)│
│   └── SettingsModal (Ringtone Selector, Tone Volume Slider)            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Client Services & Backend Infrastructure               │
├────────────────────────────────────────────────────────────────────────┤
│  Audio Engine (audio.ts):                                              │
│   • Loud Ringtones (gain: 0.85), Melodic Chimes, Volume Preferences    │
│   • Presets: Classic Ring, Modern Bell, Chime, Pop                     │
│                                                                        │
│  WebRTC Calling (webrtc.ts):                                           │
│   • STUN/TURN ICE servers, mic/cam track management, mobile camera flip│
│                                                                        │
│  Upload Pipeline:                                                      │
│   • Resumable chunked upload endpoint /api/videos/upload-chunk         │
│   • Express backend streaming with HTTP 206 Partial Content            │
│                                                                        │
│  Notification Engine (notifications.ts & sw.js):                       │
│   • Desktop/System Notification with sender avatar & click-to-focus    │
└────────────────────────────────────────────────────────────────────────┘
```

#### Interactive Component & State Mapping

| Component | Target State / Feature | Handler / Implementation |
| :--- | :--- | :--- |
| `audio.ts` | Volume & Loudness | Amplified Web Audio oscillators (`gain: 0.8`), multi-frequency chords, tone presets, volume setter. |
| `CallModal.tsx` | Incoming & Outgoing Calls | Loud looping ringtone, full-screen incoming modal with Accept/Decline, WebRTC track toggles. |
| `UnifiedChatComposer.tsx` | Media Staging & Large Video | Staged media preview card with caption input, chunked video upload with speed & ETA indicators. |
| `AddFriendModal.tsx` | Hash `#` compatibility | `normalizeFriendId` strips `#`, spaces, `@`, looks up both formatted and raw IDs in database. |
| `GroupModal.tsx` | Custom Group Image | File input for computer/gallery, thumbnail preview, image compression, saves `avatarUrl`. |
| `AuthModal.tsx` | Two-Step Registration | Step 1 (Email + Password) -> Step 2 (First Name, Last Name, Age, Country selector, Photo upload). |
| `SmartSearchModal.tsx` | Redesigned White Search | Clean white modal with filter tabs (`All`, `People`, `Groups`, `Photos`, `Videos`, `Docs`). |
| `SettingsModal.tsx` | Sound Settings | Custom ringtone selector dropdown, message tone dropdown, volume slider with live preview. |

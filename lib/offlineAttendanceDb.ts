import Dexie, { Table } from 'dexie'

export type OfflineStudent = {
  id: string
  school_id: string
  full_name: string
  qr_code_token: string
  profile_photo_path: string | null
  class_id: string
  class_name: string
  responsible_whatsapp: string | null
}

export type OfflineAttendance = {
  id: string
  school_id: string
  student_id: string
  class_id: string
  attendance_date: string
  status: 'present'
  source: 'qr' | 'facial' | 'manual'
  recorded_at: string
  synced: boolean
}

export type OfflineEarlyExit = {
  id: string
  school_id: string
  student_id: string
  class_id: string
  exit_date: string
  exit_time: string
  reason: string
  authorized_by_name: string | null
  responsible_contact: string | null
  recorded_at: string
  synced: boolean
}

export type OfflineFaceCaptureTemp = {
  id: string
  school_id: string
  student_id: string
  class_id: string
  image_blob: Blob
  captured_at: string
  processed: boolean
}

export type OfflineFaceEmbedding = {
  id: string
  school_id: string
  student_id: string
  class_id: string
  embedding: number[]
  source: 'profile_photo' | 'capture' | 'manual_average' | 'imported_photo'
  quality_score: number | null
  captured_at: string
  expires_at: string
  synced: boolean
  profile_photo_path?: string | null
}

export type OfflineFaceAttendanceAttempt = {
  id: string
  school_id: string
  student_id: string | null
  class_id: string | null
  attendance_date: string
  result: 'success' | 'already_present' | 'not_recognized' | 'low_confidence'
  confidence: number | null
  recorded_at: string
  synced: boolean
}

class OfflineAttendanceDb extends Dexie {
  students!: Table<OfflineStudent, string>
  attendance!: Table<OfflineAttendance, string>
  earlyExits!: Table<OfflineEarlyExit, string>
  faceCapturesTemp!: Table<OfflineFaceCaptureTemp, string>
  faceEmbeddings!: Table<OfflineFaceEmbedding, string>
  faceAttendanceAttempts!: Table<OfflineFaceAttendanceAttempt, string>

  constructor() {
    super('schoolos_offline_attendance')

    this.version(1).stores({
      students: 'id, school_id, qr_code_token, class_id',
      attendance:
        'id, school_id, student_id, class_id, attendance_date, synced',
    })

    this.version(2).stores({
      students: 'id, school_id, qr_code_token, class_id',
      attendance:
        'id, school_id, student_id, class_id, attendance_date, synced',
      earlyExits:
        'id, school_id, student_id, class_id, exit_date, synced',
    })

    this.version(3).stores({
      students: 'id, school_id, qr_code_token, class_id',
      attendance:
        'id, school_id, student_id, class_id, attendance_date, synced',
      earlyExits:
        'id, school_id, student_id, class_id, exit_date, synced',
      faceCapturesTemp:
        'id, school_id, student_id, class_id, captured_at, processed',
      faceEmbeddings:
        'id, school_id, student_id, class_id, source, captured_at, expires_at, synced',
      faceAttendanceAttempts:
        'id, school_id, student_id, class_id, attendance_date, result, synced',
    })

    this.version(4).stores({
  students: 'id, school_id, qr_code_token, class_id',
  attendance:
    'id, school_id, student_id, class_id, attendance_date, synced',
  earlyExits:
    'id, school_id, student_id, class_id, exit_date, synced',
  faceCapturesTemp:
    'id, school_id, student_id, class_id, captured_at, processed',
  faceEmbeddings:
    'id, school_id, student_id, class_id, source, captured_at, expires_at, synced',
  faceAttendanceAttempts:
    'id, school_id, student_id, class_id, attendance_date, result, synced',
})

this.version(5).stores({
  students: 'id, school_id, qr_code_token, class_id',
  attendance:
    'id, school_id, student_id, class_id, attendance_date, [student_id+attendance_date], synced',
  earlyExits:
    'id, school_id, student_id, class_id, exit_date, synced',
  faceCapturesTemp:
    'id, school_id, student_id, class_id, captured_at, processed',
  faceEmbeddings:
    'id, school_id, student_id, class_id, source, captured_at, expires_at, synced',
  faceAttendanceAttempts:
    'id, school_id, student_id, class_id, attendance_date, result, synced',
})

this.version(6).stores({
  students: 'id, school_id, qr_code_token, class_id',
  attendance:
    'id, school_id, student_id, class_id, attendance_date, [student_id+attendance_date], synced',
  earlyExits:
    'id, school_id, student_id, class_id, exit_date, synced',
  faceCapturesTemp:
    'id, school_id, student_id, class_id, captured_at, processed',
  faceEmbeddings:
    'id, school_id, student_id, class_id, source, captured_at, expires_at, synced, profile_photo_path',
  faceAttendanceAttempts:
    'id, school_id, student_id, class_id, attendance_date, result, synced',
})
  }
}

export const offlineAttendanceDb = new OfflineAttendanceDb()
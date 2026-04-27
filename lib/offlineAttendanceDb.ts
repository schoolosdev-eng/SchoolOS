import Dexie, { Table } from 'dexie'

export type OfflineStudent = {
  id: string
  school_id: string
  full_name: string
  qr_code_token: string
  profile_photo_path: string | null
  class_id: string
  class_name: string
}

export type OfflineAttendance = {
  id: string
  school_id: string
  student_id: string
  class_id: string
  attendance_date: string
  status: 'present'
  source: 'qr'
  recorded_at: string
  synced: boolean
}

class OfflineAttendanceDb extends Dexie {
  students!: Table<OfflineStudent, string>
  attendance!: Table<OfflineAttendance, string>

  constructor() {
    super('schoolos_offline_attendance')

    this.version(1).stores({
      students: 'id, school_id, qr_code_token, class_id',
      attendance:
        'id, school_id, student_id, class_id, attendance_date, synced',
    })
  }
}

export const offlineAttendanceDb = new OfflineAttendanceDb()
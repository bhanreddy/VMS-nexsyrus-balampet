import type {
    StudentWithDetails,
    UserWithPerson,
    LegacyStudent,
    BaseUser,
    Staff,
    AttendanceWithStudent,
} from '../types/schema';

/**
 * Transforms database Person + Student data to legacy Student format
 * Used for backward compatibility with existing UI components
 */
export function toLegacyStudent(data: StudentWithDetails): LegacyStudent {
    const { person, current_enrollment, parents } = data;

    const primaryParent = parents?.find(p => p.is_primary_contact);
    const parentPerson = primaryParent?.parent?.person;

    return {
        uid: data.id,
        email: '', // Will need to fetch from person_contacts
        displayName: person.display_name || `${person.first_name} ${person.last_name}`,
        photoURL: person.photo_url || undefined,
        role: 'student',
        firstName: person.first_name,
        lastName: person.last_name,
        admissionNo: data.admission_no,
        classId: current_enrollment?.class_section?.class?.id || '',
        section: current_enrollment?.class_section?.section?.name || '',
        rollNo: '', // Not in new schema, would need separate mapping table
        parentName: parentPerson ? `${parentPerson.first_name} ${parentPerson.last_name}` : undefined,
        parentPhone: '', // Would need to fetch from parent's person_contacts
        dob: person.dob || undefined,
        address: '', // Would need to fetch from person_contacts where type='address'
        isActive: data.deleted_at === null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

/**
 * Transforms database User + Person to legacy BaseUser format
 */
export function toLegacyUser(data: UserWithPerson, role: BaseUser['role']): BaseUser {
    const { person } = data;

    return {
        uid: data.id,
        email: '', // Need to fetch from person_contacts
        displayName: person.display_name || `${person.first_name} ${person.last_name}`,
        photoURL: person.photo_url || undefined,
        role,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

/**
 * Transforms database User + Person to legacy Staff format
 */
export function toLegacyStaff(data: UserWithPerson): Staff {
    const baseUser = toLegacyUser(data, 'staff');
    const { person } = data;

    return {
        ...baseUser,
        role: 'staff', // Could be determined from user roles
        firstName: person.first_name,
        lastName: person.last_name,
        employeeId: '', // Would need separate staff table
        designation: '', // Would need staff designation mapping
        department: '',
        phone: '', // From person_contacts
        classIds: [],
        isActive: data.account_status === 'active',
    };
}

/**
 * Transforms database attendance data to simpler format for UI
 */
export function toAttendanceRecord(data: AttendanceWithStudent) {
    return {
        id: data.id,
        studentId: data.enrollment.student.id,
        studentName: data.enrollment.student.person.display_name ||
            `${data.enrollment.student.person.first_name} ${data.enrollment.student.person.last_name}`,
        date: data.attendance_date,
        status: data.status,
        markedAt: data.marked_at,
    };
}

/**
 * Helper to get primary email from person contacts
 */
export function getPrimaryEmail(contacts?: Array<{ contact_type: string; contact_value: string; is_primary: boolean }>): string | undefined {
    return contacts?.find(c => c.contact_type === 'email' && c.is_primary)?.contact_value;
}

/**
 * Helper to get primary phone from person contacts
 */
export function getPrimaryPhone(contacts?: Array<{ contact_type: string; contact_value: string; is_primary: boolean }>): string | undefined {
    return contacts?.find(c => c.contact_type === 'phone' && c.is_primary)?.contact_value;
}

/**
 * Helper to get address from person contacts
 */
export function getAddress(contacts?: Array<{ contact_type: string; contact_value: string }>): string | undefined {
    return contacts?.find(c => c.contact_type === 'address')?.contact_value;
}

/**
 * Transforms legacy student creation data to database format
 * Returns data needed to create Person + Student + PersonContacts
 */
export function fromLegacyStudentCreate(legacy: Partial<LegacyStudent>) {
    return {
        person: {
            first_name: legacy.firstName || '',
            last_name: legacy.lastName || '',
            dob: legacy.dob || null,
            gender_id: 1, // Would need to be selected
        },
        student: {
            admission_no: legacy.admissionNo || '',
            admission_date: new Date().toISOString().split('T')[0],
            status_id: 1, // Active
        },
        contacts: [
            legacy.email ? {
                contact_type: 'email' as const,
                contact_value: legacy.email,
                is_primary: true,
            } : null,
            legacy.parentPhone ? {
                contact_type: 'phone' as const,
                contact_value: legacy.parentPhone,
                is_primary: true,
                is_emergency: true,
            } : null,
            legacy.address ? {
                contact_type: 'address' as const,
                contact_value: legacy.address,
                is_primary: true,
            } : null,
        ].filter(Boolean),
    };
}

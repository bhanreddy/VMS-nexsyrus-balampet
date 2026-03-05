// Core Role Types
export type Role = 'admin' | 'staff' | 'teacher' | 'student' | 'parent' | 'accountant' | 'driver';

// ================= AUTH & USER =================
export interface User {
    readonly id: string;
    readonly uid?: string;
    readonly email: string;
    readonly first_name: string;
    readonly last_name: string;
    readonly display_name: string;
    readonly name?: string;
    readonly photo_url?: string;
    readonly photoUrl?: string; // App expects photoUrl in some places
    readonly phone?: string; // App expects phone in staff profile
    readonly role: Role;
    readonly roles: readonly string[];
    readonly permissions: readonly string[];
    readonly admission_no?: string;
    readonly rollNo?: string; // App expects rollNo in some places
    readonly has_student_profile?: boolean;
    readonly has_staff_profile?: boolean;
    readonly classId?: string; // Mapped from class_section_id
    readonly class_section_id?: string;
    readonly staff_id?: string;
    readonly staff_code?: string;
    readonly notification_sound?: 'custom' | 'default';
    readonly gender?: string;
}

export interface AccountsUser extends User {
    readonly role: 'accountant';
}

export interface StaffProfile {
    readonly id: string;
    readonly staff_code: string;
    readonly joining_date: string;
    readonly salary: string;
    readonly person_id: string;
    readonly first_name: string;
    readonly last_name: string;
    readonly display_name: string;
    readonly gender: string;
    readonly designation: string;
    readonly status: string;
    readonly email?: string;
    readonly phone?: string;
    readonly photo_url?: string;
}

export interface StaffClassAssignment {
    readonly class_section_id: string;
    readonly class_name: string;
    readonly section_name: string;
    readonly subject_id?: string;
    readonly subject_name?: string;
    readonly is_class_teacher: boolean;
}

// ================= STUDENT PROFILE =================
export interface StudentEnrollment {
    readonly id: string;
    readonly roll_number: string;
    readonly class_code: string;
    readonly class_id: string;
    readonly section_name: string;
    readonly section_id: string;
    readonly academic_year: string;
    readonly class_teacher?: string;
}

export interface Parent {
    readonly first_name: string;
    readonly last_name: string;
    readonly relation: string;
    readonly phone?: string;
    readonly occupation?: string;
    readonly is_primary?: boolean;
    readonly is_guardian?: boolean;
}

export interface Student {
    readonly id: string;
    readonly admission_no: string;
    readonly admission_date: string;
    readonly first_name: string;
    readonly middle_name?: string;
    readonly last_name: string;
    readonly display_name: string;
    readonly name?: string;
    readonly gender_id: number;
    readonly dob: string;
    readonly status: string;
    readonly email?: string;
    readonly phone?: string;
    readonly photo_url?: string;
    readonly current_enrollment?: StudentEnrollment;
    readonly parents?: Parent[];
}

// ================= ATTENDANCE =================
export interface AttendanceSummary {
    readonly present: number;
    readonly absent: number;
    readonly late: number;
    readonly total: number;
}

export interface AttendanceRecord {
    readonly attendance_date: string;
    readonly status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday';
    readonly marked_at?: string;
    readonly class_name?: string;
    readonly section_name?: string;
}

export interface AttendanceResponse {
    readonly summary: AttendanceSummary;
    readonly records: AttendanceRecord[];
}

export interface ClassAttendanceStudent {
    readonly student_id: string;
    readonly admission_no: string;
    readonly student_name: string;
    readonly photo_url?: string;
    readonly enrollment_id: string;
    readonly attendance_id?: string;
    readonly status?: 'present' | 'absent' | 'late' | 'half_day';
    readonly marked_at?: string;
}

export interface ClassAttendanceResponse {
    readonly date: string;
    readonly class_section_id: string;
    readonly class_name: string;
    readonly section_name: string;
    readonly total_students: number;
    readonly marked_count: number;
    readonly students: ClassAttendanceStudent[];
}

// ================= FEES =================
export interface FeeSummary {
    readonly total_due: number;
    readonly total_paid: number;
    readonly balance: number;
}

export interface FeeTransaction {
    readonly id: string;
    readonly student_fee_id: string;
    readonly amount: number;
    readonly paid_at: string;
    readonly payment_method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'online';
    readonly transaction_ref?: string;
    readonly remarks?: string;
    readonly received_by?: string;
    readonly student_name?: string;
    readonly admission_no?: string;
    readonly fee_type?: string;
}

export interface FeeStructure {
    readonly id: string;
    readonly academic_year_id: string;
    readonly class_id: string;
    readonly fee_type_id: string;
    readonly amount: number;
    readonly due_date?: string;
    readonly frequency: string;
}

export interface FeeType {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly frequency?: string;
    readonly is_active?: boolean;
}

export interface StudentFee {
    readonly id: string;
    readonly student_id: string;
    readonly amount_due: number;
    readonly amount_paid: number;
    readonly discount: number;
    readonly status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
    readonly due_date: string;
    readonly fee_type: string;
    readonly fee_code?: string;
    readonly period_month?: number;
    readonly period_year?: number;
}

export interface FeeReceipt {
    readonly id: string;
    readonly receipt_no: string;
    readonly total_amount: number;
    readonly issued_at: string;
    readonly issued_by_name?: string;
    readonly student_name: string;
    readonly admission_no: string;
    readonly items: {
        readonly amount: number;
        readonly fee_type: string;
        readonly payment_method: string;
        readonly transaction_ref?: string;
        readonly paid_at: string;
    }[];
}

export interface AccountsDashboardStats {
    readonly today_collection: number;
    readonly monthly_collection: number;
    readonly collected_total: number;
    readonly pending_dues: number;
    readonly defaulter_count: number;
    readonly recent_transactions: FeeTransaction[];
}

export interface FeeResponse {
    readonly student: { readonly id: string; readonly admission_no: string; readonly display_name: string };
    readonly summary: FeeSummary;
    readonly fees: StudentFee[];
}

// ================= LMS =================
export interface LMSMaterial {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly content_url: string;
    readonly duration?: string;
    readonly material_type: 'video' | 'document' | 'link' | 'quiz' | 'assignment';
    readonly created_at: string;
    readonly course_title: string;
    readonly class_name?: string;
    readonly instructor_name?: string;
}

// ================= ANNOUNCEMENTS =================
export type NoticeAudience = 'all' | 'students' | 'staff' | 'parents' | 'class';

export interface Notice {
    readonly id: string;
    readonly title: string;
    readonly content: string;
    readonly audience: NoticeAudience;
    readonly target_class_id?: string;
    readonly priority?: 'low' | 'medium' | 'high' | 'urgent';
    readonly is_published: boolean;
    readonly is_pinned: boolean; // "Important" flag
    readonly publish_at?: string;
    readonly published_at?: string; // Kept for backward compatibility if used, but schema says ensure one naming
    readonly expires_at?: string;
    readonly created_by: string;
    readonly created_at: string;
    readonly author_name?: string;
}

// ================= ADMIN =================
export interface AdminDashboardStats {
    readonly totalStudents: number;
    readonly staffPresent: number;
    readonly totalStaff: number;
    readonly complaints: number;
    readonly collection: number;
    readonly todayCollection?: number;
}

export interface AdminUser {
    readonly id: string;
    readonly email: string;
    readonly first_name: string;
    readonly last_name: string;
    readonly display_name: string;
    readonly photo_url?: string;
    readonly account_status: 'active' | 'inactive' | 'suspended';
    readonly last_login_at?: string;
    readonly roles: string[];
    readonly permissions: string[];
}

export interface CreateUserRequest {
    readonly email: string;
    readonly password?: string; // Optional if auto-generated
    readonly first_name: string;
    readonly last_name: string;
    readonly gender_id: number;
    readonly role_codes: string[]; // e.g., ['staff', 'admin']
}

export interface UpdateUserRequest {
    readonly first_name?: string;
    readonly last_name?: string;
    readonly account_status?: 'active' | 'inactive' | 'suspended';
    readonly roles?: string[]; // Full replacement of roles
}

export interface AssignRoleRequest {
    readonly user_id: string;
    readonly role_codes: string[];
}

// ================= NEXSYRUS TABS =================

// 1. Discipline
export interface DisciplineRecord {
    readonly id: string;
    readonly student_id: string;
    readonly incident_date: string;
    readonly title: string;
    readonly description?: string;
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    readonly action_taken?: string;
    readonly reported_by?: string;
    readonly created_at: string;
}

// 2. Money Science
export interface MoneyScienceModule {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly age_group?: string;
    readonly content_url?: string;
    readonly total_points: number;
    readonly content_body?: string;
    readonly thumbnail_url?: string;
}

export interface MoneyScienceProgress {
    readonly id: string;
    readonly module_id: string;
    readonly status: 'not_started' | 'in_progress' | 'completed';
    readonly progress_percentage: number;
    readonly completed_at?: string;
}

// 3. Science Projects
export interface ScienceProject {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    readonly is_group_project: boolean;
    readonly min_participants: number;
    readonly max_participants: number;
    readonly user_status?: 'registered' | 'submitted' | 'evaluated' | 'certified'; // Joined view
    readonly user_grade?: string;
}

export interface ProjectSubmission {
    readonly id: string;
    readonly project_id: string;
    readonly status: string;
    readonly submission_url?: string;
    readonly certified_at?: string;
}

// 4. Life Values
export interface LifeValuesModule {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly content_body?: string;
    readonly banner_image_url?: string;
    readonly thumbnail_url?: string;
}

export interface LifeValuesProgress {
    readonly id: string;
    readonly module_id: string;
    readonly status: 'active' | 'completed';
    readonly engagement_score: number;
    readonly completed_at?: string;
}

// ================= FINANCIAL POLICY =================
export interface FinancialPolicyRule {
    readonly id: string;
    readonly rule_code: string;
    readonly rule_name: string;
    readonly description?: string;
    readonly value_type: 'amount' | 'percentage' | 'boolean' | 'json';
    readonly default_value: any;
    readonly current_value: any;
    readonly is_active: boolean;
    readonly updated_at: string;
}

export interface FinancialAuditLog {
    readonly id: string;
    readonly table_name: string;
    readonly record_id: string;
    readonly action_type: 'DELETE' | 'UPDATE' | 'CREATE';
    readonly old_data?: any;
    readonly new_data?: any;
    readonly reason?: string;
    readonly performed_by: string; // user_id
    readonly performed_by_name?: string; // Joined view
    readonly performed_at: string;
}

// ================= COMPLAINTS =================
export interface Complaint {
    readonly id: string;
    readonly ticket_no: string;
    readonly title: string;
    readonly description: string;
    readonly category?: 'academic' | 'fee' | 'transport' | 'hostel' | 'other';
    readonly priority?: 'low' | 'medium' | 'high' | 'urgent';
    readonly status: 'open' | 'in_progress' | 'resolved' | 'closed';
    readonly raised_by: string;
    readonly raised_by_name?: string;
    readonly raised_for_student_id?: string;
    readonly assigned_to?: string;
    readonly resolution?: string;
    readonly created_at: string;
    readonly resolved_at?: string;
}

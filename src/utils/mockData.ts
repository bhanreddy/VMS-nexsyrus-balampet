

export const MOCK_USERS: Record<string, any> = {
    'admin-1': {
        uid: 'admin-1',
        name: 'Admin User',
        email: 'admin@school.com',
        role: 'admin',
        photoUrl: 'https://cdn-icons-png.flaticon.com/512/2942/2942813.png'
    },
    'staff-1': {
        uid: 'staff-1',
        name: 'Staff Member',
        email: 'staff@school.com',
        role: 'staff', // or 'teacher'
        photoUrl: 'https://cdn-icons-png.flaticon.com/512/3406/3406795.png'
    },
    'student-1': {
        uid: 'student-1',
        name: 'John Student',
        email: 'student@school.com',
        role: 'student',
        photoUrl: 'https://cdn-icons-png.flaticon.com/512/201/201818.png'
    },
    'accountant-1': {
        uid: 'accountant-1',
        name: 'Accountant User',
        email: 'accounts@school.com',
        role: 'accountant',
        photoUrl: 'https://cdn-icons-png.flaticon.com/512/2534/2534204.png'
    }
};

export const MOCK_STUDENTS: any[] = [
    {
        id: 'student-1',
        name: 'John Student',
        email: 'student@school.com',
        classId: 'class-1',
        rollNo: '101',
        guardianName: 'Parent One',
        phone: '1234567890',
        address: '123 School Lane',
        dob: '2010-01-01',
        gender: 'Male',
        bloodGroup: 'A+',
        admissionDate: '2020-06-01',
        academicDetails: {
            class: '10',
            section: 'A',
            rollNo: '101'
        }
    },
    {
        id: 'student-2',
        name: 'Jane Doe',
        email: 'jane@school.com',
        classId: 'class-1',
        rollNo: '102',
        guardianName: 'Parent Two',
        phone: '0987654321',
        address: '456 School Ave',
        dob: '2010-02-02',
        gender: 'Female',
        bloodGroup: 'O+',
        admissionDate: '2020-06-01',
        academicDetails: {
            class: '10',
            section: 'A',
            rollNo: '102'
        }
    }
];

export const MOCK_CLASSES = [
    { id: 'class-1', name: 'Class 10-A', grade: '10', section: 'A', teacherId: 'staff-1' },
    { id: 'class-2', name: 'Class 9-B', grade: '9', section: 'B', teacherId: 'staff-2' }
];

export const MOCK_NOTICES: any[] = [
    {
        id: 'notice-1',
        title: 'School Closed Tomorrow',
        content: 'Due to heavy rains, school will be closed.',
        date: '2025-05-20',
        authorId: 'admin-1',
        targetAudience: ['student', 'staff'],
        type: 'general',
        priority: 'high'
    }
];

export const MOCK_ATTENDANCE: any[] = [
    {
        id: 'att-1',
        studentId: 'student-1',
        date: '2025-05-21',
        status: 'present',
        classId: 'class-1'
    }
];

export const MOCK_FEES: any[] = [
    {
        id: 'fee-1',
        studentId: 'student-1',
        amount: 5000,
        status: 'due',
        dueDate: '2025-06-01',
        type: 'Tuition Fee',
        updatedAt: { toDate: () => new Date('2025-05-01') }
    },
    {
        id: 'fee-2',
        studentId: 'student-1',
        amount: 2000,
        status: 'paid',
        dueDate: '2025-01-01',
        type: 'Bus Fee',
        updatedAt: { toDate: () => new Date('2024-12-28') }
    },
    {
        id: 'fee-3',
        studentId: 'student-2',
        amount: 5000,
        status: 'pending',
        dueDate: '2025-06-01',
        type: 'Tuition Fee',
        updatedAt: { toDate: () => new Date('2025-05-01') }
    },
    {
        id: 'fee-4',
        studentId: 'student-1',
        amount: 1500,
        status: 'paid',
        dueDate: '2025-02-01',
        type: 'Books & Uniform',
        updatedAt: { toDate: () => new Date('2025-01-15') }
    },
    {
        id: 'fee-5',
        studentId: 'student-2',
        amount: 3000,
        status: 'paid',
        dueDate: '2025-03-01',
        type: 'Transport Fee',
        updatedAt: { toDate: () => new Date('2025-02-10') }
    },
    {
        id: 'fee-6',
        studentId: 'student-1',
        amount: 500,
        status: 'due',
        dueDate: '2025-04-01',
        type: 'Late Fine',
        updatedAt: { toDate: () => new Date('2025-03-05') }
    }
];

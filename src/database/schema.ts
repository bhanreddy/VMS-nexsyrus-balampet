import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
    version: 2,
    tables: [
        tableSchema({
            name: 'diary_entries',
            columns: [
                { name: 'class_section_id', type: 'string' },
                { name: 'entry_date', type: 'string' },
                { name: 'subject_id', type: 'string', isOptional: true },
                { name: 'title', type: 'string', isOptional: true },
                { name: 'title_te', type: 'string', isOptional: true },
                { name: 'content', type: 'string' },
                { name: 'content_te', type: 'string', isOptional: true },
                { name: 'homework_due_date', type: 'string', isOptional: true },
                { name: 'attachments', type: 'string', isOptional: true }, // Stored as JSON
                { name: 'subject_name', type: 'string', isOptional: true },
                { name: 'created_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ]
        }),
        tableSchema({
            name: 'users',
            columns: [
                { name: 'email', type: 'string' },
                { name: 'first_name', type: 'string' },
                { name: 'last_name', type: 'string' },
                { name: 'display_name', type: 'string' },
                { name: 'role', type: 'string' },
                { name: 'photo_url', type: 'string', isOptional: true },
                { name: 'permissions', type: 'string', isOptional: true }, // JSON
            ]
        }),
    ]
})

import { Model } from '@nozbe/watermelondb'
import { date, text, readonly, json } from '@nozbe/watermelondb/decorators'

const sanitizeAttachments = (raw: any) => {
    return Array.isArray(raw) ? raw : []
}

export default class DiaryEntry extends Model {
    static table = 'diary_entries'

    @text('class_section_id') classSectionId!: string
    @text('entry_date') entryDate!: string
    @text('subject_id') subjectId?: string
    @text('title') title?: string
    @text('title_te') titleTe?: string
    @text('content') content!: string
    @text('content_te') contentTe?: string
    @text('homework_due_date') homeworkDueDate?: string
    @json('attachments', sanitizeAttachments) attachments!: string[]
    @text('subject_name') subjectName?: string
    @text('created_by') createdBy!: string
    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}

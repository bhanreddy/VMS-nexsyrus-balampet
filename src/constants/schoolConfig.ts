/**
 * Global School Configuration
 * Edit this file to change the school branding across the entire app.
 *
 * This configuration is used in:
 * - App Headers (Admin, Staff, Student)
 * - Login/Logout Screens
 * - Report Cards & Certificates
 * - PDF Generation
 */

export const SCHOOL_CONFIG = {
    // The official name of the school displayed in headers and reports
    name: "SCHOOL IMS",

    // The school logo used in headers and reports
    // Ensure the image exists in assets/images/
    logo: require('../../assets/images/icon-v2.png'),

    // Optional: School Address for reports
    address: "123 School Street, City, State - 000000",

    // Optional: Contact info for reports
    contact: "9999999999",

    // Website or Email
    website: "www.schoolims.com"
};

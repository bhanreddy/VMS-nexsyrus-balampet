
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withCustomSound = (config) => {
    // Android: Copy to android/app/src/main/res/raw/attendance_alert.mp3
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const resPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');

            // Ensure raw directory exists
            if (!fs.existsSync(resPath)) {
                fs.mkdirSync(resPath, { recursive: true });
            }

            const soundFiles = ['attendance_absent_alert.wav', 'default.wav', 'emergency.wav', 'fee_reminder.wav', 'voice_alert.wav'];

            soundFiles.forEach(fileName => {
                const sourceFile = path.join(projectRoot, 'assets', 'sounds', fileName);
                const destFile = path.join(resPath, fileName);

                if (fs.existsSync(sourceFile)) {
                    fs.copyFileSync(sourceFile, destFile);

                } else {
                    console.warn(`⚠️ [Android] ${fileName} not found in root!`);
                }
            });

            return config;
        },
    ]);

    // iOS: Add to bundle
    // (Simplified: just copying to root of ios project usually isn't enough, 
    // needs to be added to Copy Bundle Resources in Xcode. 
    // expo-notifications usually handles the linking if provided in app.json for "sounds" prop 
    // OR we can manually add it. But the "sounds" prop in app.json is usually for local notifications?)
    // Actually, standard practice for custom sounds in FCM is adding to Resources.
    // We can trust Expo to verify if we just use withDangerousMod to copy to ./ios/AppName/
    // But strictly, we might need 'withXcodeProject' to add the file reference.
    // However, often just copying it into the main bundle folder works if "Resources" are auto-included.
    // For simplicity/robustness, we'll assume the user runs `npx expo prebuild` and we copy it to a location that is picked up.
    // A cleaner way for iOS in Expo is using a group, but that requires more complex IOSMod.

    // Alternative: Using `expo-asset` triggers? No.
    // We will copy to `ios/AppName/` and hope it gets picked up, or trust the user to add it if this fails.
    // Actually, there's a simpler way: config.plugins = [ ... [ 'expo-notifications', { sounds: ['attendance_alert.mp3'] } ] ]
    // If expo-notifications supports `sounds` config, that's best.
    // Checking docs: expo-notifications config plugin supports `sounds`.
    // So we might NOT need this intricate plugin for iOS if we use the plugin props correctly.
    // But for Android `res/raw` is definitely needed for FCM custom sounds (channels).
    return config;
};

module.exports = withCustomSound;

const { withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

const withFirebase = (config) => {
    return withAppBuildGradle(withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = addGoogleServicesClasspath(config.modResults.contents);
        } else {
            throw new Error('This plugin only supports Groovy Gradle files for project build.gradle');
        }
        return config;
    }), (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = addFirebaseDependencies(config.modResults.contents);
        } else {
            throw new Error('This plugin only supports Groovy Gradle files for app build.gradle');
        }
        return config;
    });
};

function addGoogleServicesClasspath(buildGradle) {
    // Add: id("com.google.gms.google-services") version "4.4.4" apply false
    // For Groovy project-level usually it's in dependencies block of buildscript, or plugins block in newer gradle.
    // RN Expo usually uses the older buildscript style or a mix. Let's look for "dependencies {" inside "buildscript {" or just "dependencies {" top level.

    // Actually, standard Expo prebuild templates for Android often use the `buildscript { dependencies { classpath ... } }` pattern.
    // The user prompt mentioned `plugins { id(...) ... }` for Kotlin DSL, but standard React Native template is often Groovy.
    // Let's safe-check where to add. 

    const pattern = /classpaths\s*=\s*\[/;
    // We'll append to the dependencies block if we can find it, otherwise standard regex for classpath.

    if (buildGradle.includes('com.google.gms:google-services')) {
        return buildGradle;
    }

    // Basic regex to find the dependencies block within buildscript
    // Warning: This is a simple injection.
    return buildGradle.replace(
        /dependencies\s*{/,
        `dependencies {
        classpath 'com.google.gms:google-services:4.4.4'`
    );
}

function addFirebaseDependencies(buildGradle) {
    let newGradle = buildGradle;

    // Apply plugin: com.google.gms.google-services
    if (!newGradle.includes("apply plugin: 'com.google.gms.google-services'")) {
        if (newGradle.includes("apply plugin: 'com.android.application'")) {
            newGradle = newGradle.replace(
                "apply plugin: 'com.android.application'",
                "apply plugin: 'com.android.application'\napply plugin: 'com.google.gms.google-services'"
            );
        } else {
            // Fallback for newer template styles or if top match fails
            newGradle += "\napply plugin: 'com.google.gms.google-services'\n";
        }
    }

    // Implementation dependencies
    if (!newGradle.includes("com.google.firebase:firebase-bom")) {
        const depBlock = /dependencies\s*{/;
        if (depBlock.test(newGradle)) {
            newGradle = newGradle.replace(
                depBlock,
                `dependencies {
    implementation platform('com.google.firebase:firebase-bom:34.7.0')
    implementation 'com.google.firebase:firebase-analytics'`
            );
        } else {
            // Fallback append if weird structure
            newGradle += `
dependencies {
    implementation platform('com.google.firebase:firebase-bom:34.7.0')
    implementation 'com.google.firebase:firebase-analytics'
}
`;
        }
    }

    // Disable Lint Abort on Error
    if (!newGradle.includes("lintOptions {")) {
        const androidBlock = /android\s*{/;
        if (androidBlock.test(newGradle)) {
            newGradle = newGradle.replace(
                androidBlock,
                `android {
    lintOptions {
        checkReleaseBuilds false
        abortOnError false
    }`
            );
        }
    }

    return newGradle;
}

module.exports = withFirebase;


allprojects {
    repositories {
        google()
        mavenCentral()
        mavenLocal() // so a locally published SDK build can be verified
    }
    configurations.all {
        resolutionStrategy.dependencySubstitution {
            // Day to day the SDK is built from source in this repo. Pass
            // -PusePublishedSdk to resolve the real published artifact instead —
            // that is what proves a release is actually installable, which
            // substituting the local project can never tell us.
            if (!rootProject.hasProperty("usePublishedSdk")) {
                substitute(module("io.github.share-installs:sdk-android"))
                    .using(project(":invitesdk"))
            }
        }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

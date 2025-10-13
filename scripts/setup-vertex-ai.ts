#!/usr/bin/env bun

/**
 * Setup script for Vertex AI authentication
 * Helps configure Google Cloud credentials for video analysis
 */

import * as path from 'node:path'
import * as fs from 'node:fs/promises'

import { $ } from 'bun'

console.log('🔧 Vertex AI Setup Script')
console.log('========================\n')

async function checkGCloudCLI() {
  console.log('1. Checking for gcloud CLI...')
  try {
    await $`which gcloud`.quiet()
    const version = await $`gcloud --version`.text()
    console.log('✅ gcloud CLI found:')
    console.log(version.split('\n')[0])
    return true
  } catch {
    console.log('❌ gcloud CLI not found')
    console.log('   Please install: https://cloud.google.com/sdk/docs/install')
    return false
  }
}

async function checkAuthentication() {
  console.log('\n2. Checking authentication...')
  try {
    const account =
      await $`gcloud auth list --filter=status:ACTIVE --format="value(account)"`.text()
    if (account.trim()) {
      console.log(`✅ Authenticated as: ${account.trim()}`)
      return true
    }
  } catch {}

  console.log('❌ Not authenticated')
  console.log('   Run: gcloud auth application-default login')
  return false
}

async function checkProject() {
  console.log('\n3. Checking project configuration...')
  try {
    const project = await $`gcloud config get-value project`.text()
    if (project.trim()) {
      console.log(`✅ Project set to: ${project.trim()}`)
      return project.trim()
    }
  } catch {}

  console.log('❌ No project configured')
  console.log('   Run: gcloud config set project YOUR_PROJECT_ID')
  return null
}

async function setupApplicationDefaultCredentials() {
  console.log('\n4. Setting up Application Default Credentials...')

  const credsPath = path.join(
    process.env.HOME || '~',
    '.config/gcloud/application_default_credentials.json',
  )

  try {
    await fs.access(credsPath)
    console.log(`✅ ADC found at: ${credsPath}`)
    return true
  } catch {
    console.log('❌ Application Default Credentials not found')
    console.log('   Setting up ADC...\n')

    console.log('   Please run the following command:')
    console.log('   gcloud auth application-default login\n')
    console.log('   This will open your browser to authenticate.')
    return false
  }
}

async function createEnvFile(project: string | null) {
  console.log('\n5. Creating .env.local with Vertex AI configuration...')

  const envPath = path.join(process.cwd(), '.env.local')
  const envExamplePath = path.join(process.cwd(), '.env.local.example')

  try {
    // Read existing env file or example
    let envContent = ''
    try {
      envContent = await fs.readFile(envPath, 'utf-8')
    } catch {
      try {
        envContent = await fs.readFile(envExamplePath, 'utf-8')
      } catch {
        envContent = ''
      }
    }

    // Get current project
    const resolvedProject =
      project ??
      (await $`gcloud config get-value project`
        .text()
        .catch(() => 'your-project-id'))

    // Add Vertex AI configuration if not present
    const vertexConfig = `
# Vertex AI Configuration (for direct video analysis)
GOOGLE_CLOUD_PROJECT=${resolvedProject.trim()}
GOOGLE_CLOUD_LOCATION=us-central1

# Use Vertex AI for video analysis (actual video content analysis)
USE_VERTEX_AI=true

# Enable chunking for long videos (Vertex AI only)
ENABLE_CHUNKING=false
SEGMENT_DURATION=180
`

    if (!envContent.includes('GOOGLE_CLOUD_PROJECT')) {
      envContent += vertexConfig
      await fs.writeFile(envPath, envContent)
      console.log('✅ Added Vertex AI configuration to .env.local')
    } else {
      console.log('✅ Vertex AI configuration already in .env.local')
    }

    console.log('\n   Review and update .env.local with your settings:')
    console.log(`   - GOOGLE_CLOUD_PROJECT=${resolvedProject.trim()}`)
    console.log('   - GOOGLE_CLOUD_LOCATION=us-central1')
  } catch (error) {
    console.log('⚠️  Could not update .env.local')
    console.log('   Please manually add the Vertex AI configuration')
  }
}

async function testVertexAPI(project: string | null) {
  console.log('\n6. Testing Vertex AI API access...')

  try {
    // Check if Vertex AI API is enabled
    if (!project) {
      return false
    }

    const apiStatus =
      await $`gcloud services list --enabled --filter="name:aiplatform.googleapis.com" --format="value(name)" --project=${project.trim()}`.text()

    if (apiStatus.includes('aiplatform')) {
      console.log('✅ Vertex AI API is enabled')
      return true
    } else {
      console.log('❌ Vertex AI API is not enabled')
      console.log(
        `   Enable it: gcloud services enable aiplatform.googleapis.com --project=${project.trim()}`,
      )
      return false
    }
  } catch (error) {
    console.log('⚠️  Could not check Vertex AI API status')
    console.log("   Make sure it's enabled in your Google Cloud Console")
    return false
  }
}

// Main setup flow
async function main() {
  const gcloud = await checkGCloudCLI()
  const auth = gcloud ? await checkAuthentication() : false
  const project = gcloud ? await checkProject() : null
  const adc =
    auth && project ? await setupApplicationDefaultCredentials() : false

  if (auth && project) {
    await createEnvFile(project)
  }

  const api = project ? await testVertexAPI(project) : false

  const status = (value: boolean) => (value ? '✅' : '❌')

  console.log('\n' + '='.repeat(50))
  console.log('Setup Summary:')
  console.log('='.repeat(50))
  console.log(`gcloud CLI:     ${status(gcloud)}`)
  console.log(`Authentication: ${status(auth)}`)
  console.log(`Project:        ${project ? `✅ ${project}` : '❌'}`)
  console.log(`ADC:            ${status(adc)}`)
  console.log(`Vertex AI API:  ${status(api)}`)

  if (gcloud && auth && project && adc && api) {
    console.log('\n✅ Vertex AI is ready to use!')
    console.log('   You can now analyze actual video content.')
    return
  }

  console.log('\n⚠️  Some setup steps are incomplete.')
  console.log('   Follow the instructions above to complete setup.')

  if (!gcloud) {
    console.log(
      '\n❌ Install the gcloud CLI first: https://cloud.google.com/sdk/docs/install',
    )
  }

  if (!auth || !project) {
    console.log('\nQuick setup commands:')
    console.log('1. gcloud auth login')
    console.log('2. gcloud config set project YOUR_PROJECT_ID')
    console.log('3. gcloud auth application-default login')
    console.log('4. gcloud services enable aiplatform.googleapis.com')
  }

  if (auth && project && !adc) {
    console.log('\nRun: gcloud auth application-default login')
  }

  if (project && !api) {
    console.log(
      `\nEnable the Vertex AI API: gcloud services enable aiplatform.googleapis.com --project=${project}`,
    )
  }

  process.exit(1)
}

main().catch(console.error)

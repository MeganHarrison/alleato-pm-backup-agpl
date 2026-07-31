import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Types for our database
export interface CaptureSession {
  id?: string;
  started_at?: string;
  completed_at?: string;
  capture_type: 'public_docs' | 'authenticated_app' | 'manual';
  status: 'in_progress' | 'completed' | 'failed';
  total_screenshots?: number;
  notes?: string;
}

export interface Screenshot {
  id?: string;
  session_id: string;
  name: string;
  category: string;
  subcategory?: string;
  source_url?: string;
  page_title?: string;
  fullpage_path?: string;
  viewport_path?: string;
  fullpage_storage_path?: string;
  viewport_storage_path?: string;
  viewport_width?: number;
  viewport_height?: number;
  fullpage_height?: number;
  file_size_bytes?: number;
  description?: string;
  detected_components?: any[];
  color_palette?: any[];
  ai_analysis?: any;
  captured_at?: string;
}

export interface Component {
  id?: string;
  screenshot_id: string;
  component_type: string;
  component_name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  local_path?: string;
  storage_path?: string;
  styles?: any;
  content?: string;
}

// Initialize Supabase client
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) environment variables.'
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

export class ScreenshotDatabase {
  private supabase: SupabaseClient;
  private sessionId: string | null = null;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  async startSession(captureType: CaptureSession['capture_type'], notes?: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('procore_capture_sessions')
      .insert({
        capture_type: captureType,
        status: 'in_progress',
        notes,
      })
      .select('id')
      .single();

    if (error) throw error;
    this.sessionId = data.id;
    console.log(`📸 Started capture session: ${this.sessionId}`);
    return this.sessionId;
  }

  async completeSession(totalScreenshots: number): Promise<void> {
    if (!this.sessionId) throw new Error('No active session');

    const { error } = await this.supabase
      .from('procore_capture_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_screenshots: totalScreenshots,
      })
      .eq('id', this.sessionId);

    if (error) throw error;
    console.log(`✅ Completed session with ${totalScreenshots} screenshots`);
  }

  async failSession(errorMessage: string): Promise<void> {
    if (!this.sessionId) return;

    await this.supabase
      .from('procore_capture_sessions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: errorMessage,
      })
      .eq('id', this.sessionId);
  }

  // ============================================
  // SCREENSHOT MANAGEMENT
  // ============================================

  async saveScreenshot(screenshot: Omit<Screenshot, 'session_id'>): Promise<string> {
    if (!this.sessionId) throw new Error('No active session. Call startSession first.');

    const { data, error } = await this.supabase
      .from('procore_screenshots')
      .insert({
        ...screenshot,
        session_id: this.sessionId,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async updateScreenshot(id: string, updates: Partial<Screenshot>): Promise<void> {
    const { error } = await this.supabase
      .from('procore_screenshots')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================
  // STORAGE MANAGEMENT
  // ============================================

  async uploadScreenshot(
    localPath: string,
    storagePath: string
  ): Promise<string> {
    const fileBuffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);

    const { data, error } = await this.supabase.storage
      .from('procore-screenshots')
      .upload(storagePath, fileBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) throw error;

    // Get public URL (if bucket is public) or signed URL
    const { data: urlData } = this.supabase.storage
      .from('procore-screenshots')
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  }

  async uploadAndSaveScreenshot(
    localFullpagePath: string | null,
    localViewportPath: string | null,
    metadata: Omit<Screenshot, 'session_id' | 'fullpage_storage_path' | 'viewport_storage_path'>
  ): Promise<string> {
    const storageBasePath = `${metadata.category}/${metadata.name}`;
    
    let fullpageStoragePath: string | undefined;
    let viewportStoragePath: string | undefined;
    let fileSize = 0;

    // Upload fullpage screenshot
    if (localFullpagePath && fs.existsSync(localFullpagePath)) {
      fullpageStoragePath = `${storageBasePath}/fullpage.png`;
      await this.uploadScreenshot(localFullpagePath, fullpageStoragePath);
      fileSize += fs.statSync(localFullpagePath).size;
    }

    // Upload viewport screenshot
    if (localViewportPath && fs.existsSync(localViewportPath)) {
      viewportStoragePath = `${storageBasePath}/viewport.png`;
      await this.uploadScreenshot(localViewportPath, viewportStoragePath);
      fileSize += fs.statSync(localViewportPath).size;
    }

    // Save to database
    return this.saveScreenshot({
      ...metadata,
      fullpage_storage_path: fullpageStoragePath,
      viewport_storage_path: viewportStoragePath,
      file_size_bytes: fileSize,
    });
  }

  // ============================================
  // COMPONENT MANAGEMENT
  // ============================================

  async saveComponent(component: Component): Promise<string> {
    const { data, error } = await this.supabase
      .from('procore_components')
      .insert(component)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async saveComponents(screenshotId: string, components: Omit<Component, 'screenshot_id'>[]): Promise<void> {
    const componentsWithScreenshotId = components.map(c => ({
      ...c,
      screenshot_id: screenshotId,
    }));

    const { error } = await this.supabase
      .from('procore_components')
      .insert(componentsWithScreenshotId);

    if (error) throw error;
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  async getModules() {
    const { data, error } = await this.supabase
      .from('procore_modules')
      .select('*')
      .order('category', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getScreenshotsByCategory(category: string) {
    const { data, error } = await this.supabase
      .from('procore_screenshots')
      .select('*')
      .eq('category', category)
      .order('captured_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getCaptureProgress() {
    const { data, error } = await this.supabase
      .from('procore_capture_summary')
      .select('*');

    if (error) throw error;
    return data;
  }

  async getRebuildEstimate() {
    const { data, error } = await this.supabase
      .from('procore_rebuild_estimate')
      .select('*');

    if (error) throw error;
    return data;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('procore_modules')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const db = new ScreenshotDatabase();

// Export for direct Supabase access if needed
export { getSupabaseClient };

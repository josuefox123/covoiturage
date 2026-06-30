/**
 * ==========================================================
 * Fichier :
 * support.ts
 * 
 * Description :
 * Déclarations des interfaces TypeScript pour le Centre de Support Zemy.
 * 
 * Projet :
 * Zemy
 * ==========================================================
 */

export interface Participant {
  id: string
  full_name?: string | null
  phone: string
  email?: string | null
  avatar?: string | null
  rating?: number
  is_verified?: boolean
  is_active?: boolean
  created_at?: string
  is_staff?: boolean
  is_superuser?: boolean
}

export interface Message {
  id: string
  conversation: string
  sender: string
  sender_details?: Participant | null
  content?: string
  message_type: 'text' | 'image' | 'audio' | 'file' | 'location'
  attachment?: string | null
  attachment_url?: string | null
  location_lat?: number | null
  location_lng?: number | null
  is_read: boolean
  is_urgent: boolean
  created_at: string
  moderation_status?: string
}

export interface Conversation {
  id: string
  conversation_type: 'ride' | 'support'
  ride?: string | null
  participant_1: string
  participant_2?: string | null
  participant_1_details?: Participant | null
  participant_2_details?: Participant | null
  created_at: string
  updated_at: string
  last_message?: Message | null
  unread_count?: number
  has_urgent_unread?: boolean
}

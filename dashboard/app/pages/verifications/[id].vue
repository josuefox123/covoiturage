<!--
==========================================================
Fichier :
[id].vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <!-- Toast Notification -->
  <ToastNotification
    :show="toast.show"
    :type="toast.type"
    :title="toast.title"
    :message="toast.message"
    @close="toast.show = false"
  />

  <!-- Loading State -->
  <div v-if="pending" class="flex flex-col items-center justify-center py-24 gap-4">
    <svg class="w-10 h-10 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
    <p class="text-textMuted text-sm">Chargement de la vérification...</p>
  </div>

  <div v-else-if="req" class="space-y-6">

    <!-- PAGE HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <NuxtLink to="/verifications" class="p-2 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
        </NuxtLink>
        <div>
          <h1 class="text-xl font-bold text-text">Vérification d'identité</h1>
          <p class="text-xs text-textMuted mt-0.5 font-mono">Réf : {{ req.id.split('-')[0].toUpperCase() }}...{{ req.id.slice(-6).toUpperCase() }}</p>
        </div>
      </div>
      <span class="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border"
        :class="{
          'bg-amber-50 text-amber-700 border-amber-200': req.status === 'pending',
          'bg-emerald-50 text-emerald-700 border-emerald-200': req.status === 'approved',
          'bg-red-50 text-red-700 border-red-200': req.status === 'rejected'
        }">
        <span class="w-2 h-2 rounded-full"
          :class="{
            'bg-amber-500 animate-pulse': req.status === 'pending',
            'bg-emerald-500': req.status === 'approved',
            'bg-red-500': req.status === 'rejected'
          }"></span>
        {{ req.status === 'pending' ? "En attente d'examen" : req.status === 'approved' ? 'Identité vérifiée' : 'Demande rejetée' }}
      </span>
    </div>

    <!-- MAIN GRID -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">

      <!-- LEFT COLUMN -->
      <div class="xl:col-span-1 flex flex-col gap-4">

        <!-- Profile Card -->
        <div class="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div class="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5"></div>
          <div class="px-6 pb-6 -mt-8">
            <div class="relative w-16 h-16 mb-3">
              <img
                :src="getMediaUrl(req.user_details.avatar) || '/images/default-avatar.png'"
                class="w-16 h-16 rounded-2xl object-cover border-4 border-card shadow-md"
                onerror="this.src='/images/default-avatar.png'"
              />
              <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card"
                :class="{
                  'bg-amber-400': req.status === 'pending',
                  'bg-emerald-400': req.status === 'approved',
                  'bg-red-400': req.status === 'rejected'
                }"></span>
            </div>
            <h2 class="text-lg font-bold text-text leading-tight">{{ req.user_details.full_name || 'Inconnu' }}</h2>
            <p class="text-sm text-textMuted mt-0.5">{{ req.user_details.phone }}</p>
          </div>
        </div>

        <!-- Metadata Card -->
        <div class="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h3 class="text-xs font-semibold text-textMuted uppercase tracking-widest mb-4">Informations</h3>
          <div class="space-y-0">
            <div class="flex items-center justify-between py-3 border-b border-border/50">
              <span class="text-sm text-textMuted">Soumis le</span>
              <span class="text-sm font-medium text-text">{{ new Date(req.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) }}</span>
            </div>
            <div class="flex items-center justify-between py-3 border-b border-border/50">
              <span class="text-sm text-textMuted">Documents</span>
              <span class="text-sm font-semibold text-text">{{ [req.selfie, req.selfie_id, req.id_front, req.id_back].filter(Boolean).length }} / 4</span>
            </div>
            <div class="flex items-center justify-between py-3">
              <span class="text-sm text-textMuted">Référence</span>
              <code class="text-xs bg-background px-2 py-1 rounded-lg text-textMuted font-mono border border-border">{{ req.id.split('-')[0] }}</code>
            </div>
          </div>
        </div>

        <!-- Action Card -->
        <div class="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h3 class="text-xs font-semibold text-textMuted uppercase tracking-widest mb-4">Décision</h3>

          <div v-if="req.status === 'pending'" class="space-y-3">
            <button
              @click="showApproveModal = true"
              :disabled="actionPending"
              class="w-full flex items-center justify-center gap-2.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
              Approuver la demande
            </button>
            <button
              @click="showRejectModal = true"
              :disabled="actionPending"
              class="w-full flex items-center justify-center gap-2.5 py-3 bg-card hover:bg-red-50 border border-red-200 text-red-600 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              Rejeter
            </button>
          </div>

          <div v-else class="flex flex-col items-center text-center py-4 gap-2">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center"
              :class="req.status === 'approved' ? 'bg-emerald-100' : 'bg-red-100'">
              <svg v-if="req.status === 'approved'" class="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
              <svg v-else class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
            </div>
            <p class="text-sm font-semibold" :class="req.status === 'approved' ? 'text-emerald-700' : 'text-red-700'">
              {{ req.status === 'approved' ? 'Demande approuvée' : 'Demande rejetée' }}
            </p>
            <p class="text-xs text-textMuted">Traitement déjà effectué</p>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN - Documents -->
      <div class="xl:col-span-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-border flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-text">Documents d'identité</h3>
            <p class="text-xs text-textMuted">Cliquez sur une image pour l'agrandir</p>
          </div>
        </div>

        <div class="p-6 space-y-8">

          <!-- Biometric photos -->
          <div>
            <p class="text-xs font-semibold text-textMuted uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/></svg>
              Vérification biométrique
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Selfie -->
              <div
                class="group relative rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                @click="previewImage = getMediaUrl(req.selfie); showPreview = true"
              >
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                <div class="absolute bottom-10 left-0 right-0 flex justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span class="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/30">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803 7.5 7.5 0 0 0 15.803 15.803zM10.5 7.5v6m3-3h-6"/></svg>
                    Agrandir
                  </span>
                </div>
                <img :src="getMediaUrl(req.selfie)" class="w-full h-56 object-cover bg-background" />
                <div class="px-4 py-2.5 border-t border-border flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                  <p class="text-xs font-semibold text-text">Selfie</p>
                </div>
              </div>

              <!-- Selfie + ID -->
              <div v-if="req.selfie_id"
                class="group relative rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                @click="previewImage = getMediaUrl(req.selfie_id); showPreview = true"
              >
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                <div class="absolute bottom-10 left-0 right-0 flex justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span class="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/30">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803 7.5 7.5 0 0 0 15.803 15.803zM10.5 7.5v6m3-3h-6"/></svg>
                    Agrandir
                  </span>
                </div>
                <img :src="getMediaUrl(req.selfie_id)" class="w-full h-56 object-cover bg-background" />
                <div class="px-4 py-2.5 border-t border-border flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-violet-400"></span>
                  <p class="text-xs font-semibold text-text">Selfie + Pièce d'identité</p>
                </div>
              </div>
              <div v-else class="rounded-xl border border-dashed border-border flex flex-col items-center justify-center h-56 gap-2 text-textMuted">
                <svg class="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>
                <p class="text-xs text-center">Selfie + Pièce<br/><span class="opacity-60">Non fourni</span></p>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="border-t border-border"></div>

          <!-- ID Documents -->
          <div>
            <p class="text-xs font-semibold text-textMuted uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/></svg>
              Pièce d'identité officielle
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Recto -->
              <div
                class="group relative rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                @click="previewImage = getMediaUrl(req.id_front); showPreview = true"
              >
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                <div class="absolute bottom-10 left-0 right-0 flex justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span class="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/30">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803 7.5 7.5 0 0 0 15.803 15.803zM10.5 7.5v6m3-3h-6"/></svg>
                    Agrandir
                  </span>
                </div>
                <img :src="getMediaUrl(req.id_front)" class="w-full h-44 object-cover bg-background" />
                <div class="px-4 py-2.5 border-t border-border flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <p class="text-xs font-semibold text-text">Recto</p>
                </div>
              </div>

              <!-- Verso -->
              <div
                class="group relative rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                @click="previewImage = getMediaUrl(req.id_back); showPreview = true"
              >
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                <div class="absolute bottom-10 left-0 right-0 flex justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span class="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/30">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803 7.5 7.5 0 0 0 15.803 15.803zM10.5 7.5v6m3-3h-6"/></svg>
                    Agrandir
                  </span>
                </div>
                <img :src="getMediaUrl(req.id_back)" class="w-full h-44 object-cover bg-background" />
                <div class="px-4 py-2.5 border-t border-border flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-orange-400"></span>
                  <p class="text-xs font-semibold text-text">Verso</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- IMAGE LIGHTBOX -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPreview" class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4" @click.self="showPreview = false">
          <div class="relative max-w-4xl w-full flex flex-col items-center gap-4">
            <button @click="showPreview = false" class="self-end w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
            <img :src="previewImage" class="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modale Approuver -->
    <Teleport to="body">
      <div v-if="showApproveModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
              </div>
              <div>
                <h3 class="text-base font-bold text-text">Approuver la demande</h3>
                <p class="text-xs text-textMuted mt-0.5">Le compte sera marqué comme vérifié</p>
              </div>
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-text mb-2">Message pour le client <span class="text-textMuted font-normal">(optionnel)</span></label>
              <textarea v-model="approveMotif" rows="3" placeholder="Ex : Documents conformes, identité vérifiée avec succès..." class="w-full px-4 py-3 rounded-xl border border-border bg-background text-text placeholder-textMuted text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"></textarea>
            </div>
            <div class="flex gap-3">
              <button @click="showApproveModal = false; approveMotif = ''" class="flex-1 py-3 rounded-xl border border-border text-textMuted font-semibold text-sm hover:bg-background transition-colors">Annuler</button>
              <button @click="approve" :disabled="actionPending" class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
                <svg v-if="actionPending" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                Confirmer l'approbation
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modale Rejeter -->
    <Teleport to="body">
      <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </div>
              <div>
                <h3 class="text-base font-bold text-text">Rejeter la demande</h3>
                <p class="text-xs text-textMuted mt-0.5">Le client recevra une notification</p>
              </div>
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-text mb-2">Motif du rejet <span class="text-red-500">*</span></label>
              <textarea v-model="rejectMotif" rows="4" placeholder="Ex : Photo floue, document expiré, selfie non conforme..." class="w-full px-4 py-3 rounded-xl border border-border bg-background text-text placeholder-textMuted text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all" :class="{ 'border-red-500 ring-2 ring-red-500/30': rejectError }"></textarea>
              <p v-if="rejectError" class="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>
                {{ rejectError }}
              </p>
            </div>
            <div class="flex gap-3">
              <button @click="showRejectModal = false; rejectMotif = ''; rejectError = ''" class="flex-1 py-3 rounded-xl border border-border text-textMuted font-semibold text-sm hover:bg-background transition-colors">Annuler</button>
              <button @click="reject" :disabled="actionPending" class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
                <svg v-if="actionPending" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

const route = useRoute()
const { fetchApi } = useApi()

const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })

function showToast(type: string, title: string, msg = '') {
  toast.type = type
  toast.title = title
  toast.message = msg
  toast.show = true
}

const req = ref<any>(null)
const pending = ref(true)
const actionPending = ref(false)

// Modales
const showApproveModal = ref(false)
const showRejectModal = ref(false)
const approveMotif = ref('')
const rejectMotif = ref('')
const rejectError = ref('')

// Lightbox
const showPreview = ref(false)
const previewImage = ref('')

const fetchDetail = async () => {
  pending.value = true
  try {
    const data = await fetchApi(`/verifications/${route.params.id}/`)
    req.value = data
  } catch (error) {
    console.error('Erreur', error)
  } finally {
    pending.value = false
  }
}

const approve = async () => {
  actionPending.value = true
  try {
    await fetchApi(`/verifications/${route.params.id}/approve/`, {
      method: 'POST',
      body: { motif: approveMotif.value },
    })
    showApproveModal.value = false
    approveMotif.value = ''
    showToast('success', 'Succès', 'Demande approuvée avec succès.')
    await fetchDetail()
  } catch (error) {
    console.error(error)
    showToast('error', 'Erreur', "Une erreur est survenue lors de l'approbation.")
  } finally {
    actionPending.value = false
  }
}

const reject = async () => {
  if (!rejectMotif.value.trim()) {
    rejectError.value = 'Le motif est obligatoire pour un rejet.'
    return
  }
  rejectError.value = ''
  actionPending.value = true
  try {
    await fetchApi(`/verifications/${route.params.id}/reject/`, {
      method: 'POST',
      body: { motif: rejectMotif.value },
    })
    showRejectModal.value = false
    rejectMotif.value = ''
    showToast('success', 'Succès', 'Demande rejetée.')
    await fetchDetail()
  } catch (error) {
    console.error(error)
    showToast('error', 'Erreur', "Une erreur est survenue lors du rejet.")
  } finally {
    actionPending.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

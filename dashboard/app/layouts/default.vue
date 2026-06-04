<template>
  <div class="flex h-screen bg-background">
    <Sidebar />
    <div class="flex flex-col flex-1 overflow-hidden">
      <header class="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <div class="text-xl font-bold text-text">Dashboard Administration</div>
        <div class="flex items-center space-x-4">
          <button class="p-2 text-textLight hover:text-primary transition-colors">
            <Icon name="ph:bell" class="w-6 h-6" />
          </button>
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              A
            </div>
            <span class="text-sm font-medium text-text">Admin</span>
          </div>
        </div>
      </header>
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

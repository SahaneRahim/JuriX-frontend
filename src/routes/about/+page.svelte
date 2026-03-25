<script lang="ts">
  import { fade } from "svelte/transition";
  import { tr } from "$lib/stores/language";
</script>

<div
  class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 relative"
  in:fade
>
  <!-- Back Button -->
  <a
    href="/"
    class="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-lg shadow-sm font-medium text-sm"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      ><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
    >
    {$tr("common.back")}
  </a>

  <div class="max-w-4xl mx-auto space-y-12 pt-8">
    <!-- Hero Section -->
    <div class="text-center space-y-4">
      <h1
        class="text-4xl font-extrabold text-slate-900 sm:text-5xl sm:tracking-tight lg:text-6xl"
      >
        {$tr("about.title")} <span class="text-blue-600">JuriX</span>
      </h1>
      <p class="max-w-2xl mx-auto text-xl text-slate-500">
        {$tr("about.subtitle")}
      </p>
    </div>

    <!-- Mission Card -->
    <div
      class="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-8 sm:p-12"
    >
      <div class="space-y-6">
        <h2 class="text-3xl font-bold text-slate-900">
          {$tr("about.mission.title")}
        </h2>

        <div class="prose prose-lg text-slate-600 space-y-6">
          <p>
            {$tr("about.mission.p1")}
          </p>

          <p>
            {$tr("about.mission.p2")}
          </p>

          <div class="grid md:grid-cols-2 gap-6 mt-8">
            <div class="flex items-start space-x-4 p-4 bg-blue-50 rounded-lg">
              <div class="flex-shrink-0">
                <svg
                  class="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">
                  {$tr("about.centralization.title")}
                </h3>
                <p class="text-sm text-gray-600">
                  {$tr("about.centralization.desc")}
                </p>
              </div>
            </div>

            <div class="flex items-start space-x-4 p-4 bg-purple-50 rounded-lg">
              <div class="flex-shrink-0">
                <svg
                  class="h-6 w-6 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">
                  {$tr("about.ai.title")}
                </h3>
                <p class="text-sm text-gray-600">{$tr("about.ai.desc")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Creator Signature -->
    <div class="text-center pt-8 border-t border-slate-200">
      <p
        class="text-sm text-slate-500 uppercase tracking-widest font-semibold mb-2"
      >
        {$tr("about.creator")}
      </p>
      <h3 class="text-2xl font-serif text-slate-800 italic">
        KANA SAHANE ABDELAZIZ RAHIM & AARON FOZEU
      </h3>
    </div>

    <!-- Contact Section -->
    <div class="border-t border-slate-200 pt-8 pb-8">
      <h2 class="text-2xl font-bold text-slate-900 text-center mb-8">
        {$tr("about.contact.title")}
      </h2>
      <div class="grid md:grid-cols-3 gap-6 text-center">
        <div class="p-4 bg-white rounded-lg shadow-sm border border-slate-100">
          <div class="text-2xl mb-2">📞</div>
          <div class="font-medium text-slate-900">
            {$tr("about.contact.phone")}
          </div>
          <a href="tel:+237693672462" class="text-blue-600 hover:underline"
            >+237 693 67 24 62</a
          >
        </div>
        <div class="p-4 bg-white rounded-lg shadow-sm border border-slate-100">
          <div class="text-2xl mb-2">💬</div>
          <div class="font-medium text-slate-900">
            {$tr("about.contact.whatsapp")}
          </div>
          <a
            href="https://wa.me/237696383736"
            class="text-green-600 hover:underline">+237 696 38 37 36</a
          >
        </div>
        <div class="p-4 bg-white rounded-lg shadow-sm border border-slate-100">
          <div class="text-2xl mb-2">📧</div>
          <div class="font-medium text-slate-900">
            {$tr("about.contact.email")}
          </div>
          <a
            href="mailto:rahimsahane@gmail.com"
            class="text-blue-600 hover:underline">rahimsahane@gmail.com</a
          >
        </div>
      </div>
    </div>
  </div>
</div>

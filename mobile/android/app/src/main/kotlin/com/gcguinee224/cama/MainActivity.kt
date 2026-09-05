package com.gcguinee224.cama

import io.flutter.embedding.android.FlutterFragmentActivity

// FlutterFragmentActivity (et non FlutterActivity) — requis par le plugin
// local_auth pour afficher le verrou natif du téléphone (BiometricPrompt),
// qui a besoin d'une FragmentActivity (§ décidé en conversation,
// déverrouillage rapide).
class MainActivity : FlutterFragmentActivity()

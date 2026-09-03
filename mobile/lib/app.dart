import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'features/marketplace/data/marketplace_api.dart';
import 'routing/app_router.dart';
import 'state/auth_state.dart';
import 'state/update_state.dart';

class App extends StatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  // Le routeur est construit une seule fois (dans initState), pas à chaque
  // build : go_router garde son propre état de navigation, et c'est
  // `refreshListenable` (voir app_router.dart) qui le fait réagir aux
  // changements de AuthState, pas une recréation de l'objet.
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final authState = context.read<AuthState>();
    _router = buildAppRouter(
      authState,
      context.read<MarketplaceApi>(),
      context.read<UpdateState>(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Gestion Commerciale',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0F5E9C),
        // Coins arrondis + poignée de glissement sur TOUTES les feuilles
        // modales de l'app (Caisse, Client, Récapitulatif, Reçu...) — un
        // seul réglage central plutôt que répété à chaque appel. La
        // poignée signale visuellement "on peut glisser" à un public peu
        // habitué au numérique, sans avoir besoin de l'expliquer.
        bottomSheetTheme: const BottomSheetThemeData(
          showDragHandle: true,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        ),
      ),
      // Seul le français est proposé : le public cible n'a pas besoin (ni
      // l'app d'ailleurs) d'un choix de langue, et ça évite que les
      // widgets Material intégrés (sélecteur de date, boutons "Annuler"/
      // "OK"...) retombent silencieusement en anglais.
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('fr')],
      locale: const Locale('fr'),
      routerConfig: _router,
    );
  }
}

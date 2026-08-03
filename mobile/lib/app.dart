import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'routing/app_router.dart';
import 'state/auth_state.dart';

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
    _router = buildAppRouter(authState);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Gestion Commerciale',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0F5E9C),
      ),
      routerConfig: _router,
    );
  }
}

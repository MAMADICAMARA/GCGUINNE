import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/employee_models.dart';
import '../../data/employees_api.dart';

/// Miroir de AddEmployeeModal.jsx — toujours en tant que Vendeur/Caissier,
/// pas de rôle Manager (abandonné, contexte guinéen). Retourne le résultat
/// serveur si l'ajout a réussi, `null` sinon.
Future<AddEmployeeResult?> showAddEmployeeSheet(BuildContext context) {
  return showModalBottomSheet<AddEmployeeResult>(
    context: context,
    isScrollControlled: true,
    builder: (context) => const _AddEmployeeSheet(),
  );
}

class _AddEmployeeSheet extends StatefulWidget {
  const _AddEmployeeSheet();

  @override
  State<_AddEmployeeSheet> createState() => _AddEmployeeSheetState();
}

class _AddEmployeeSheetState extends State<_AddEmployeeSheet> {
  final _emailController = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'E-mail invalide.');
      return;
    }

    setState(() => _submitting = true);
    try {
      final result = await context.read<EmployeesApi>().add(email);
      if (!mounted) return;
      Navigator.of(context).pop(result);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Ajouter un employé', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 8),
              Text(
                "Si cette personne a déjà un compte, elle est rattachée immédiatement. Sinon, elle sera automatiquement ajoutée dès qu'elle créera son compte avec cet e-mail.",
                style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 16),
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              TextField(
                controller: _emailController,
                autofocus: true,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'E-mail', hintText: 'employe@exemple.com', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Envoi...' : 'Ajouter'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

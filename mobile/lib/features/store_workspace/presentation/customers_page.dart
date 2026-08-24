import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/customer_models.dart';
import '../data/customers_api.dart';
import 'customers/customer_history_sheet.dart';
import 'customers/pay_balance_sheet.dart';

const _kPageLimit = 20;

/// Miroir de CustomersPage.jsx — liste paginée, recherche, filtre "doivent
/// de l'argent", création rapide (nom + téléphone seulement — beaucoup de
/// clients sont non lettrés, un formulaire long serait un frein réel en
/// caisse), fiche/historique complet et encaissement de solde.
class CustomersPage extends StatefulWidget {
  const CustomersPage({super.key});

  @override
  State<CustomersPage> createState() => _CustomersPageState();
}

class _CustomersPageState extends State<CustomersPage> {
  CustomerListResult? _result;
  bool _loading = true;
  String? _error;

  int _page = 1;
  String _search = '';
  bool _owingOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<CustomersApi>().list(page: _page, limit: _kPageLimit, search: _search, owingOnly: _owingOnly);
      if (!mounted) return;
      setState(() {
        _result = result;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.message;
        _loading = false;
      });
    }
  }

  void _applyChange(VoidCallback change) {
    setState(() {
      change();
      _page = 1;
    });
    _load();
  }

  void _goToPage(int page) {
    setState(() => _page = page);
    _load();
  }

  Future<void> _openCreateSheet() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _CreateCustomerSheet(),
    );
    if (created == true) _load();
  }

  Future<void> _openPayBalance(Customer customer) async {
    final paid = await showPayBalanceSheet(context, customer);
    if (paid == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateSheet,
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Ajouter'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            TextField(
              onChanged: (value) => _applyChange(() => _search = value),
              decoration: const InputDecoration(
                hintText: 'Rechercher par nom ou téléphone...',
                prefixIcon: Icon(Icons.search, size: 20),
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => _applyChange(() => _owingOnly = !_owingOnly),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Checkbox(value: _owingOnly, onChanged: (_) => _applyChange(() => _owingOnly = !_owingOnly)),
                    const Text('Clients qui doivent uniquement', style: TextStyle(fontSize: 12.5)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              Padding(padding: const EdgeInsets.only(top: 24), child: Text(_error!, style: const TextStyle(color: Colors.red)))
            else if (_result == null || _result!.customers.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 48),
                child: Column(
                  children: [
                    Icon(Icons.people_outline, size: 40, color: Colors.grey.shade300),
                    const SizedBox(height: 10),
                    Text(
                      _owingOnly ? "Aucun client ne doit d'argent actuellement." : 'Aucun client trouvé.',
                      style: TextStyle(color: Colors.grey.shade500),
                    ),
                  ],
                ),
              )
            else ...[
              for (final customer in _result!.customers)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _CustomerCard(
                    customer: customer,
                    onTap: () => showCustomerHistorySheet(context, customer.id),
                    onPay: () => _openPayBalance(customer),
                  ),
                ),
              const SizedBox(height: 4),
              _Pagination(
                page: _result!.page,
                pages: _result!.pages,
                total: _result!.total,
                onPrevious: _result!.page > 1 ? () => _goToPage(_result!.page - 1) : null,
                onNext: _result!.page < _result!.pages ? () => _goToPage(_result!.page + 1) : null,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.customer, required this.onTap, required this.onPay});

  final Customer customer;
  final VoidCallback onTap;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(customer.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                ),
                Text(formatGNF(customer.totalSpent), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
              ],
            ),
            Text(
              '${customer.phone ?? '—'} · depuis le ${formatDate(customer.createdAt)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
            ),
            if (customer.balanceDue > 0) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(20)),
                      child: Text(
                        'Doit ${formatGNF(customer.balanceDue)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.red.shade700),
                      ),
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: onPay,
                    style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: Size.zero),
                    child: const Text('Payer le reste', style: TextStyle(fontSize: 11.5)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CreateCustomerSheet extends StatefulWidget {
  const _CreateCustomerSheet();

  @override
  State<_CreateCustomerSheet> createState() => _CreateCustomerSheetState();
}

class _CreateCustomerSheetState extends State<_CreateCustomerSheet> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = 'Le nom du client est requis.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<CustomersApi>().create(
            name: _nameController.text.trim(),
            phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
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
              const Text('Nouveau client', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 14),
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              TextField(
                controller: _nameController,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Nom', hintText: 'Mamadou Diallo', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Téléphone (optionnel)', hintText: '622 00 00 00', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Ajout...' : 'Ajouter'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pagination extends StatelessWidget {
  const _Pagination({required this.page, required this.pages, required this.total, required this.onPrevious, required this.onNext});

  final int page;
  final int pages;
  final int total;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        TextButton.icon(onPressed: onPrevious, icon: const Icon(Icons.chevron_left, size: 18), label: const Text('Précédent')),
        Expanded(
          child: Text(
            'Page $page / $pages ($total clients)',
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
          ),
        ),
        TextButton.icon(onPressed: onNext, icon: const Icon(Icons.chevron_right, size: 18), label: const Text('Suivant'), iconAlignment: IconAlignment.end),
      ],
    );
  }
}

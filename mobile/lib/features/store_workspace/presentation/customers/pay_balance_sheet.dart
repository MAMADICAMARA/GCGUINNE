import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/customer_models.dart';
import '../../data/customers_api.dart';

/// Miroir de PayBalanceModal.jsx — encaisser tout ou partie du solde dû
/// d'un client. Retourne `true` si un paiement a été enregistré.
Future<bool?> showPayBalanceSheet(BuildContext context, Customer customer) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _PayBalanceSheet(customer: customer),
  );
}

class _PayBalanceSheet extends StatefulWidget {
  const _PayBalanceSheet({required this.customer});

  final Customer customer;

  @override
  State<_PayBalanceSheet> createState() => _PayBalanceSheetState();
}

class _PayBalanceSheetState extends State<_PayBalanceSheet> {
  late final TextEditingController _amountController;
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController(text: widget.customer.balanceDue.toStringAsFixed(0));
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    final amount = num.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Le montant doit être supérieur à 0.');
      return;
    }
    if (amount > widget.customer.balanceDue) {
      setState(() => _error = 'Le montant ne peut pas dépasser le solde dû (${formatGNF(widget.customer.balanceDue)}).');
      return;
    }

    setState(() => _submitting = true);
    try {
      await context.read<CustomersApi>().recordPayment(customerId: widget.customer.id, amount: amount);
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
              const Text('Encaisser un paiement', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 4),
              Text(widget.customer.name, style: const TextStyle(fontSize: 13.5)),
              Text.rich(
                TextSpan(
                  style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                  children: [
                    const TextSpan(text: 'Solde dû : '),
                    TextSpan(text: formatGNF(widget.customer.balanceDue), style: TextStyle(fontWeight: FontWeight.w700, color: Colors.red.shade600)),
                  ],
                ),
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
                controller: _amountController,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Montant à encaisser', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 6),
              Text('Pré-rempli avec le solde total — modifiable pour un paiement partiel.', style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Enregistrement...' : 'Confirmer le paiement'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

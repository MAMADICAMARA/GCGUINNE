import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/icon_badge.dart';
import '../../account/data/stores_api.dart';
import '../data/employee_models.dart';
import '../data/employees_api.dart';
import 'employees/add_employee_sheet.dart';

/// Miroir de EmployeesPage.jsx — réservé au Owner (déjà vérifié côté
/// serveur par requireRole('OWNER') sur toutes les routes /employees).
/// Pas de rôle Manager (abandonné, contexte guinéen : §21_abandon_role_manager.sql)
/// — un employé est toujours Vendeur, aucun changement de rôle possible.
class EmployeesPage extends StatefulWidget {
  const EmployeesPage({super.key});

  @override
  State<EmployeesPage> createState() => _EmployeesPageState();
}

class _EmployeesPageState extends State<EmployeesPage> {
  List<Employee>? _employees;
  List<EmployeeInvitation>? _invitations;
  PlanStatus? _planStatus;
  String? _error;
  String? _successMessage;
  int? _busyId;
  Timer? _successTimer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _successTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final employeesApi = context.read<EmployeesApi>();
      final storesApi = context.read<StoresApi>();
      final results = await Future.wait([
        employeesApi.list(),
        employeesApi.listInvitations(),
        storesApi.getPlanStatus(),
      ]);
      if (!mounted) return;
      setState(() {
        _employees = results[0] as List<Employee>;
        _invitations = results[1] as List<EmployeeInvitation>;
        _planStatus = results[2] as PlanStatus;
        _error = null;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  void _showSuccess(String message) {
    _successTimer?.cancel();
    setState(() => _successMessage = message);
    _successTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) setState(() => _successMessage = null);
    });
  }

  Future<void> _openAddSheet() async {
    final result = await showAddEmployeeSheet(context);
    if (result == null) return;
    _showSuccess(
      result.invitationPending
          ? 'Invitation envoyée à ${result.email}. Elle sera ajoutée automatiquement dès qu\'elle créera son compte avec cet e-mail.'
          : '${result.fullName} a été ajouté(e) à l\'équipe en tant que ${kRoleLabels[result.roleCode]}.',
    );
    _load();
  }

  Future<void> _removeEmployee(Employee employee) async {
    final employeesApi = context.read<EmployeesApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Retirer cet employé ?'),
        content: Text('Retirer ${employee.fullName} de l\'équipe ?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade600),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Retirer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyId = employee.userId);
    try {
      await employeesApi.remove(employee.userId);
      await _load();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _cancelInvitation(EmployeeInvitation invitation) async {
    setState(() => _busyId = -invitation.id);
    try {
      await context.read<EmployeesApi>().cancelInvitation(invitation.id);
      await _load();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final employees = _employees;
    final invitations = _invitations;
    final canInvite = !(_planStatus?.isEffectivelyFreemium ?? true);

    return Scaffold(
      floatingActionButton: (_planStatus == null)
          ? null
          : FloatingActionButton.extended(
              onPressed: canInvite ? _openAddSheet : null,
              backgroundColor: canInvite ? null : Colors.grey.shade400,
              icon: const Icon(Icons.person_add_alt_1_outlined),
              label: const Text('Ajouter un employé'),
            ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            Text('Gérez les employés de votre boutique.', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500)),
            const SizedBox(height: 14),
            if (_planStatus != null && !canInvite)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10)),
                child: Text(
                  'Votre plan ${_planStatus!.planName} ne permet aucun employé — passez à un plan payant pour inviter votre équipe.',
                  style: TextStyle(fontSize: 12, color: Colors.amber.shade800),
                ),
              ),
            if (_successMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
                child: Text(_successMessage!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
              ),
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ),
            if (employees == null)
              const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator()))
            else ...[
              const Text("Membres de l'équipe", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              const SizedBox(height: 8),
              for (final employee in employees)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _EmployeeCard(
                    employee: employee,
                    busy: _busyId == employee.userId,
                    onRemove: () => _removeEmployee(employee),
                  ),
                ),
              if (invitations != null && invitations.isNotEmpty) ...[
                const SizedBox(height: 10),
                const Text('Invitations en attente', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                const SizedBox(height: 8),
                for (final invitation in invitations)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _InvitationCard(
                      invitation: invitation,
                      busy: _busyId == -invitation.id,
                      onCancel: () => _cancelInvitation(invitation),
                    ),
                  ),
                const SizedBox(height: 4),
                Text(
                  'En attente que la personne crée son compte avec cet e-mail — elle sera alors automatiquement ajoutée à cette boutique.',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _EmployeeCard extends StatelessWidget {
  const _EmployeeCard({required this.employee, required this.busy, required this.onRemove});

  final Employee employee;
  final bool busy;
  final VoidCallback onRemove;

  static String _initials(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = employee.roleCode == 'OWNER';
    final roleColor = isOwner ? AppColors.violet : AppColors.emerald;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: roleColor.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Text(_initials(employee.fullName), style: TextStyle(color: roleColor, fontWeight: FontWeight.w700, fontSize: 14)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(employee.fullName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: roleColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                      child: Text(
                        kRoleLabels[employee.roleCode] ?? employee.roleCode,
                        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: roleColor),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(Icons.mail_outline, size: 12, color: Colors.grey.shade400),
                    const SizedBox(width: 4),
                    Expanded(child: Text(employee.email, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: Colors.grey.shade500))),
                  ],
                ),
                if (employee.phone != null && employee.phone!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Icons.phone_outlined, size: 12, color: Colors.grey.shade400),
                      const SizedBox(width: 4),
                      Text(employee.phone!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    ],
                  ),
                ],
                if (!isOwner) ...[
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: busy ? null : onRemove,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.person_remove_outlined, size: 13, color: Colors.red.shade400),
                        const SizedBox(width: 4),
                        Text('Retirer', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.red.shade400)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InvitationCard extends StatelessWidget {
  const _InvitationCard({required this.invitation, required this.busy, required this.onCancel});

  final EmployeeInvitation invitation;
  final bool busy;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.amber.shade100)),
      child: Row(
        children: [
          const IconBadge(icon: Icons.mark_email_unread_outlined, color: AppColors.amber, size: 34),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(invitation.email, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                const SizedBox(height: 2),
                Text(
                  '${kRoleLabels[invitation.roleCode] ?? invitation.roleCode} · ${formatDateTime(invitation.createdAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, color: Colors.amber.shade800),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            onTap: busy ? null : onCancel,
            child: Text('Annuler', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
          ),
        ],
      ),
    );
  }
}

async function payBalance(req, res, next) {
  try {
    checkValidation(req);
    const customer = await customersService.recordPayment(
      req.auth.storeId,
      req.params.id,
      req.body.amount,
      req.auth.userId
    );
    res.status(200).json({ customer });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // ... vos exports existants
  payBalance,
};
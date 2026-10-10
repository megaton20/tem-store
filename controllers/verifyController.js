const { VerificationCode, Product, ProductionBatch } = require('../models');

function showVerifyForm(req, res) {
  res.render('verify', { title: 'Verify Your Product — TEM Store', result: null, submittedCode: null });
}

async function checkCode(req, res) {
  const rawCode = (req.body.code || '').trim().toUpperCase();

  if (!rawCode) {
    return res.render('verify', { title: 'Verify Your Product — TEM Store', result: { type: 'invalid' }, submittedCode: rawCode });
  }

  const record = await VerificationCode.findOne({
    where: { code: rawCode },
    include: [Product, ProductionBatch],
  });

  if (!record) {
    return res.render('verify', {
      title: 'Verify Your Product — TEM Store',
      result: { type: 'invalid' },
      submittedCode: rawCode,
    });
  }

  if (record.status === 'verified') {
    // Same session retrying (e.g. their first submit timed out) - this is
    // still them, not reuse. Show the same success they'd have gotten the
    // first time, rather than a scary "already verified" warning.
    if (record.verifiedBySessionId && record.verifiedBySessionId === req.sessionID) {
      return res.render('verify', {
        title: 'Verify Your Product — TEM Store',
        result: {
          type: 'genuine',
          product: record.Product,
          batch: record.ProductionBatch,
        },
        submittedCode: rawCode,
      });
    }

    return res.render('verify', {
      title: 'Verify Your Product — TEM Store',
      result: {
        type: 'already_used',
        product: record.Product,
        batch: record.ProductionBatch,
        verifiedAt: record.verifiedAt,
      },
      submittedCode: rawCode,
    });
  }

  // first-time verification: lock the code so it can never be reused by anyone else
  record.status = 'verified';
  record.verifiedAt = new Date();
  record.verifiedBySessionId = req.sessionID;
  await record.save();

  res.render('verify', {
    title: 'Verify Your Product — TEM Store',
    result: {
      type: 'genuine',
      product: record.Product,
      batch: record.ProductionBatch,
    },
    submittedCode: rawCode,
  });
}

module.exports = { showVerifyForm, checkCode };

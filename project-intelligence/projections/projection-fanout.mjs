function countCandidateRows(rows) {
  return rows.reduce((total, row) => total + Number(row.count ?? 0), 0);
}

export async function projectSourceSignals({
  packet,
  candidates,
  shouldWrite,
  writeCandidates,
  readBackCandidates,
}) {
  if (!shouldWrite) {
    return { writeResult: { deleted: 0, inserted: 0 }, readBackRows: [], readBackCount: 0 };
  }
  const writeResult = await writeCandidates(candidates, packet);
  const readBackRows = await readBackCandidates(packet);
  const readBackCount = countCandidateRows(readBackRows);
  if (writeResult.inserted !== candidates.length || readBackCount !== candidates.length) {
    throw new Error(
      `Daily Deep Read candidate readback failed for packet ${packet.id}: ` +
      `expected=${candidates.length}, inserted=${writeResult.inserted}, readBack=${readBackCount}.`,
    );
  }
  return { writeResult, readBackRows, readBackCount };
}

export async function projectOperatingRecords({
  packet,
  projectStateRecords,
  taskRecords,
  progressReports,
  shouldWrite,
  withTransaction,
  writeProjectCurrentState,
  readBackProjectCurrentState,
  writeTasks,
  writeProgressReports,
  promoteCompletedPacket,
  candidateCount,
  candidateReadBackCount,
}) {
  const dryRun = {
    projectStateResult: { updated: 0, richUpdated: 0, skipped: 0, rejected: 0 },
    projectStateReadBack: { expected: projectStateRecords.length, matched: 0, missingProjectIds: [] },
    taskWriteResult: { deleted: 0, inserted: 0 },
    progressReportResult: { created: 0, refreshed: 0, skipped: 0 },
    progressReportAccounted: 0,
    runContract: { status: "dry_run", requestedPacketType: packet.packet_json?.runContract?.requestedPacketType ?? null },
  };
  if (!shouldWrite) return dryRun;

  return withTransaction(null, async (client) => {
    const projectStateResult = await writeProjectCurrentState(projectStateRecords, packet, client);
    const projectStateReadBack = await readBackProjectCurrentState(
      packet,
      projectStateRecords.map((record) => Number(record.project_id)),
      client,
    );
    const taskWriteResult = await writeTasks(taskRecords, packet, client);
    if (taskWriteResult.inserted !== taskRecords.length) {
      throw new Error(
        `Daily Deep Read task write failed for packet ${packet.id}: ` +
        `expected=${taskRecords.length}, inserted=${taskWriteResult.inserted}.`,
      );
    }
    const progressReportResult = await writeProgressReports(progressReports, packet, client);
    const progressReportAccounted =
      Number(progressReportResult.created ?? 0) +
      Number(progressReportResult.refreshed ?? 0) +
      Number(progressReportResult.skipped ?? 0);
    if (progressReportAccounted !== progressReports.length) {
      throw new Error(
        `Daily Deep Read progress-report readback failed for packet ${packet.id}: ` +
        `expected=${progressReports.length}, accounted=${progressReportAccounted}.`,
      );
    }
    const consumerReceipt = {
      candidateCount,
      candidateReadBackCount,
      projectStateExpected: projectStateRecords.length,
      projectStateMatched: projectStateReadBack.matched,
      taskCount: taskRecords.length,
      tasksInserted: taskWriteResult.inserted,
      progressReportsExpected: progressReports.length,
      progressReportsAccounted: progressReportAccounted,
    };
    const runContract = await promoteCompletedPacket(packet, consumerReceipt, client);
    return {
      projectStateResult,
      projectStateReadBack,
      taskWriteResult,
      progressReportResult,
      progressReportAccounted,
      runContract,
    };
  });
}

export async function runProjectionFanout({
  packet,
  candidates,
  projectStateRecords,
  taskRecords,
  progressReports,
  shouldWrite,
  dependencies,
}) {
  const sourceSignals = await projectSourceSignals({
    packet,
    candidates,
    shouldWrite,
    writeCandidates: dependencies.writeCandidates,
    readBackCandidates: dependencies.readBackCandidates,
  });
  const operatingRecords = await projectOperatingRecords({
    packet,
    projectStateRecords,
    taskRecords,
    progressReports,
    shouldWrite,
    withTransaction: dependencies.withTransaction,
    writeProjectCurrentState: dependencies.writeProjectCurrentState,
    readBackProjectCurrentState: dependencies.readBackProjectCurrentState,
    writeTasks: dependencies.writeTasks,
    writeProgressReports: dependencies.writeProgressReports,
    promoteCompletedPacket: dependencies.promoteCompletedPacket,
    candidateCount: candidates.length,
    candidateReadBackCount: sourceSignals.readBackCount,
  });
  return { ...sourceSignals, ...operatingRecords };
}

export { countCandidateRows };
